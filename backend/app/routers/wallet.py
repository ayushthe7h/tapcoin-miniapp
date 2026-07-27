from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import WalletConnectRequest, WalletOut

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


def _to_out(user: User) -> WalletOut:
    return WalletOut(
        balance=float(user.balance),
        wallet_type=user.wallet_type,
        wallet_address=user.wallet_address,
        wallet_connected=bool(user.wallet_address),
        wallet_connected_at=user.wallet_connected_at,
    )


@router.get("/me", response_model=WalletOut)
async def wallet_info(user: User = Depends(get_current_user)):
    """Loads the saved wallet automatically — the client calls this on login."""
    return _to_out(user)


@router.post("/connect", response_model=WalletOut)
async def connect_wallet(
    payload: WalletConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or edit the user's USDT (Polygon) withdrawal address. Validation of
    wallet_type and address format happens in the WalletConnectRequest schema."""
    user.wallet_type = payload.wallet_type
    user.wallet_address = payload.address
    user.wallet_connected_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return _to_out(user)


@router.delete("/connect", response_model=WalletOut)
async def disconnect_wallet(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.wallet_type = None
    user.wallet_address = None
    user.wallet_connected_at = None
    await db.commit()
    await db.refresh(user)
    return _to_out(user)


@router.post("/withdraw")
async def withdraw_disabled():
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Withdrawals are not available yet")
