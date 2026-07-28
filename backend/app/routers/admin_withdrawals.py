from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_admin
from app.models import User, Withdrawal, AdminUser
from app.schemas import AdminWithdrawOut, AdminWithdrawActionRequest

router = APIRouter(prefix="/api/admin/withdrawals", tags=["admin-withdrawals"])


async def _log(db: AsyncSession, admin: AdminUser, action: str):
    from app.models import AdminLog
    db.add(AdminLog(admin_username=admin.username, action=action))
    await db.commit()


def _to_admin_out(w: Withdrawal, u: User) -> AdminWithdrawOut:
    return AdminWithdrawOut(
        id=w.id, amount=float(w.amount), wallet_address=w.wallet_address, wallet_type=w.wallet_type,
        gas_fee_wallet=w.gas_fee_wallet, gas_fee_sol_amount=float(w.gas_fee_sol_amount),
        gas_fee_txn_id=w.gas_fee_txn_id, gas_fee_status=w.gas_fee_status,
        withdrawal_status=w.withdrawal_status, admin_notes=w.admin_notes,
        created_at=w.created_at, updated_at=w.updated_at, completed_at=w.completed_at,
        user_id=u.id, telegram_id=u.telegram_id, username=u.username,
        first_name=u.first_name, last_name=u.last_name,
    )


async def _notify(telegram_id: int, title: str, message: str):
    # Best-effort push via the bot — a failed notification never blocks the
    # underlying approve/reject action, since the status change is already
    # visible to the user in-app via polling.
    try:
        from app.services.telegram_notify import send_broadcast
        await send_broadcast([telegram_id], title, message)
    except Exception:
        pass


@router.get("", response_model=list[AdminWithdrawOut])
async def list_withdrawals(
    status_filter: str | None = Query(None, alias="status"),  # pending | approved | rejected | completed
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Withdrawal, User).join(User, User.id == Withdrawal.user_id).order_by(desc(Withdrawal.created_at))
        )
    ).all()

    out = [_to_admin_out(w, u) for w, u in rows]
    if status_filter:
        out = [
            o for o in out
            if status_filter in (o.gas_fee_status, o.withdrawal_status)
        ]
    return out


async def _get_withdrawal(db: AsyncSession, withdrawal_id: int) -> tuple[Withdrawal, User]:
    row = (
        await db.execute(
            select(Withdrawal, User).join(User, User.id == Withdrawal.user_id).where(Withdrawal.id == withdrawal_id)
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Withdrawal request not found")
    return row


@router.post("/{withdrawal_id}/approve-gas-fee", response_model=AdminWithdrawOut)
async def approve_gas_fee(
    withdrawal_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    w, u = await _get_withdrawal(db, withdrawal_id)
    if w.gas_fee_status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Gas fee is not pending")

    w.gas_fee_status = "approved"
    await db.commit()
    await db.refresh(w)
    await _log(db, admin, f"Approved gas fee for withdrawal #{w.id}")
    await _notify(
        u.telegram_id, "Gas Fee Verified",
        "Your gas fee has been verified. Your withdrawal is now waiting for final approval.",
    )
    return _to_admin_out(w, u)


@router.post("/{withdrawal_id}/reject-gas-fee", response_model=AdminWithdrawOut)
async def reject_gas_fee(
    withdrawal_id: int, payload: AdminWithdrawActionRequest,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    w, u = await _get_withdrawal(db, withdrawal_id)
    if w.gas_fee_status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Gas fee is not pending")

    w.gas_fee_status = "rejected"
    w.withdrawal_status = "rejected"
    if payload.admin_notes:
        w.admin_notes = payload.admin_notes
    await db.commit()
    await db.refresh(w)
    await _log(db, admin, f"Rejected gas fee for withdrawal #{w.id}")
    await _notify(
        u.telegram_id, "Gas Fee Rejected",
        f"Your gas fee could not be verified.{' Reason: ' + payload.admin_notes if payload.admin_notes else ''} "
        "You can submit a new withdrawal request.",
    )
    return _to_admin_out(w, u)


@router.post("/{withdrawal_id}/approve-withdrawal", response_model=AdminWithdrawOut)
async def approve_withdrawal(
    withdrawal_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    w, u = await _get_withdrawal(db, withdrawal_id)
    if w.gas_fee_status != "approved":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Gas fee must be approved before the withdrawal can be")
    if w.withdrawal_status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Withdrawal is not pending")

    if Decimal(u.balance) < Decimal(w.amount):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User no longer has sufficient balance")

    from datetime import datetime, timezone
    u.balance = Decimal(u.balance) - Decimal(w.amount)
    w.withdrawal_status = "completed"
    w.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(w)
    await _log(db, admin, f"Approved withdrawal #{w.id} ({w.amount} USDT)")
    await _notify(
        u.telegram_id, "Withdrawal Approved",
        "Your withdrawal has been approved and processed.",
    )
    # NOTE: this only records the approval and deducts the balance — no
    # blockchain transaction is sent automatically. The admin must send the
    # USDT manually to wallet_address using the details shown in this record.
    return _to_admin_out(w, u)


@router.post("/{withdrawal_id}/reject-withdrawal", response_model=AdminWithdrawOut)
async def reject_withdrawal(
    withdrawal_id: int, payload: AdminWithdrawActionRequest,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    w, u = await _get_withdrawal(db, withdrawal_id)
    if w.withdrawal_status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Withdrawal is not pending")

    w.withdrawal_status = "rejected"
    if payload.admin_notes:
        w.admin_notes = payload.admin_notes
    await db.commit()
    await db.refresh(w)
    await _log(db, admin, f"Rejected withdrawal #{w.id}")
    await _notify(
        u.telegram_id, "Withdrawal Rejected",
        f"Your withdrawal request was rejected.{' Reason: ' + payload.admin_notes if payload.admin_notes else ''} "
        "Your balance is unaffected — you can submit a new request.",
    )
    return _to_admin_out(w, u)
