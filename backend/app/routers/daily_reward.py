from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, DailyReward
from app.schemas import DailyRewardStatusOut
from app.utils.game_settings import get_setting

router = APIRouter(prefix="/api/daily-reward", tags=["daily-reward"])

COOLDOWN = timedelta(hours=24)
QUANT = Decimal("0.000001")


async def _compute_status(user: User, db: AsyncSession) -> DailyRewardStatusOut:
    base = int(await get_setting(db, "daily_reward_base"))
    bonus = int(await get_setting(db, "daily_reward_streak_bonus"))
    rate = Decimal(await get_setting(db, "coin_to_usdt_rate"))

    if user.last_daily_claim is None:
        reward_coins = base
        return DailyRewardStatusOut(
            can_claim=True,
            next_claim_at=None,
            current_streak=user.daily_streak,
            reward_coins=reward_coins,
            reward_usdt=float((Decimal(reward_coins) * rate).quantize(QUANT)),
        )

    next_claim_at = user.last_daily_claim + COOLDOWN
    now = datetime.now(timezone.utc)
    can_claim = now >= next_claim_at
    upcoming_streak = user.daily_streak + 1 if can_claim else user.daily_streak
    reward_coins = base + bonus * min(upcoming_streak, 30)
    return DailyRewardStatusOut(
        can_claim=can_claim,
        next_claim_at=None if can_claim else next_claim_at,
        current_streak=user.daily_streak,
        reward_coins=reward_coins,
        reward_usdt=float((Decimal(reward_coins) * rate).quantize(QUANT)),
    )


@router.get("/status", response_model=DailyRewardStatusOut)
async def status_(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _compute_status(user, db)


@router.post("/claim", response_model=DailyRewardStatusOut)
async def claim(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current = await _compute_status(user, db)
    if not current.can_claim:
        # Prevents claiming more than once every 24 hours — enforced server-side
        # regardless of what the client thinks the countdown says.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Daily reward already claimed")

    now = datetime.now(timezone.utc)
    # Streak continues only if claimed within 48h of the previous claim, otherwise resets
    if user.last_daily_claim and (now - user.last_daily_claim) <= timedelta(hours=48):
        user.daily_streak += 1
    else:
        user.daily_streak = 1

    usdt_amount = Decimal(str(current.reward_usdt)).quantize(QUANT, rounding=ROUND_DOWN)
    user.balance = (Decimal(user.balance) + usdt_amount).quantize(QUANT, rounding=ROUND_DOWN)
    user.last_daily_claim = now

    db.add(DailyReward(
        user_id=user.id, streak=user.daily_streak,
        coins=current.reward_coins, usdt_earned=usdt_amount,
    ))
    await db.commit()

    return await _compute_status(user, db)
