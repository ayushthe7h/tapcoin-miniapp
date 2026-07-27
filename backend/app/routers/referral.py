from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Referral
from app.schemas import ReferralOut, ReferralHistoryEntry
from app.utils.game_settings import get_setting

router = APIRouter(prefix="/api/referral", tags=["referral"])


@router.get("/me", response_model=ReferralOut)
async def my_referral(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    reward = float(await get_setting(db, "referral_reward_inviter"))
    bot_username = settings.BOT_USERNAME or "YourBot"
    return ReferralOut(
        referral_code=user.referral_code,
        referral_link=f"https://t.me/{bot_username}?startapp={user.referral_code}",
        total_referrals=user.total_referrals,
        total_referral_earnings=float(user.total_referral_earnings),
        reward_per_referral=reward,
    )


@router.get("/history", response_model=list[ReferralHistoryEntry])
async def referral_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(User.username, User.first_name, Referral.reward_amount, Referral.created_at)
            .join(Referral, Referral.referred_id == User.id)
            .where(Referral.referrer_id == user.id)
            .order_by(Referral.created_at.desc())
        )
    ).all()
    return [
        ReferralHistoryEntry(
            username=r[0], first_name=r[1], reward_amount=float(r[2]), created_at=r[3]
        )
        for r in rows
    ]
