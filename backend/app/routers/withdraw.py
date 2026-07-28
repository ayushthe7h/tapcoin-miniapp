from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Withdrawal
from app.schemas import (
    WithdrawSettingsOut, WithdrawCreateRequest, WithdrawOut,
)
from app.utils.game_settings import get_setting

router = APIRouter(prefix="/api/withdraw", tags=["withdraw"])


# A withdrawal request is "active" (blocks new requests) unless it has reached
# a terminal state: the withdrawal itself was completed/rejected, or the gas
# fee was rejected outright (which ends that specific request).
def _is_terminal(w: Withdrawal) -> bool:
    return w.withdrawal_status in ("completed", "rejected") or w.gas_fee_status == "rejected"


@router.get("/settings", response_model=WithdrawSettingsOut)
async def withdraw_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return WithdrawSettingsOut(
        min_withdrawal=float(await get_setting(db, "min_withdrawal_usdt")),
        max_withdrawal=float(await get_setting(db, "max_withdrawal_usdt")),
        gas_fee_sol=float(await get_setting(db, "gas_fee_sol")),
        gas_fee_wallet_address=await get_setting(db, "gas_fee_wallet_address"),
        request_validity_minutes=int(await get_setting(db, "withdraw_request_validity_minutes")),
    )


@router.get("/active", response_model=WithdrawOut | None)
async def active_withdrawal(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The user's current in-flight request (if any) — drives the progress tracker
    and keeps the Withdraw button disabled on the client."""
    rows = (
        await db.execute(
            select(Withdrawal).where(Withdrawal.user_id == user.id).order_by(Withdrawal.created_at.desc())
        )
    ).scalars().all()
    for w in rows:
        if not _is_terminal(w):
            return w
    return None


@router.get("/history", response_model=list[WithdrawOut])
async def withdraw_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Withdrawal).where(Withdrawal.user_id == user.id).order_by(Withdrawal.created_at.desc())
        )
    ).scalars().all()
    return rows


@router.post("/request", response_model=WithdrawOut)
async def create_withdrawal(
    payload: WithdrawCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # --- Prevent multiple pending withdrawals ---
    existing = (
        await db.execute(select(Withdrawal).where(Withdrawal.user_id == user.id))
    ).scalars().all()
    if any(not _is_terminal(w) for w in existing):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You already have a withdrawal request in progress",
        )

    min_withdrawal = Decimal(await get_setting(db, "min_withdrawal_usdt"))
    max_withdrawal = Decimal(await get_setting(db, "max_withdrawal_usdt"))
    amount = Decimal(str(payload.amount))

    if amount < min_withdrawal:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Minimum withdrawal is {min_withdrawal} USDT")
    if max_withdrawal > 0 and amount > max_withdrawal:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Maximum withdrawal is {max_withdrawal} USDT")
    if amount > Decimal(user.balance):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Insufficient balance")

    # Balance is NOT deducted here — only once an admin approves the withdrawal
    # (see routers/admin_withdrawals.py). This request only reserves nothing;
    # the "no second pending request" rule above is what prevents double-spending
    # the same balance across concurrent requests.
    gas_fee_wallet = await get_setting(db, "gas_fee_wallet_address")
    gas_fee_sol = Decimal(await get_setting(db, "gas_fee_sol"))

    w = Withdrawal(
        user_id=user.id,
        amount=amount,
        wallet_address=payload.wallet_address,
        wallet_type=payload.wallet_type,
        gas_fee_wallet=gas_fee_wallet,
        gas_fee_sol_amount=gas_fee_sol,
        gas_fee_txn_id=payload.gas_fee_txn_id,
        gas_fee_status="pending",
        withdrawal_status="pending",
    )
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return w
