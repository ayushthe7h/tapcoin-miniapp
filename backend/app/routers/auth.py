import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, Referral, utcnow
from app.schemas import AuthResponse, TelegramAuthRequest, UserOut
from app.utils.game_settings import get_setting
from app.utils.security import create_access_token, parse_and_verify_init_data, InitDataError
from app.utils.serializers import user_to_out

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/telegram", response_model=AuthResponse)
async def telegram_auth(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = parse_and_verify_init_data(payload.init_data)
    except InitDataError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))

    raw_user = data.get("user")
    if not raw_user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No user in init data")

    tg_user = json.loads(raw_user)
    telegram_id = tg_user["id"]

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        user = User(
            telegram_id=telegram_id,
            username=tg_user.get("username"),
            first_name=tg_user.get("first_name"),
            last_name=tg_user.get("last_name"),
            photo_url=tg_user.get("photo_url"),
        )
        db.add(user)
        await db.flush()  # get user.id before handling referral
    else:
        user.username = tg_user.get("username")
        user.first_name = tg_user.get("first_name")
        user.last_name = tg_user.get("last_name")
        user.photo_url = tg_user.get("photo_url")
        user.last_login = utcnow()

    # Referral handling — only for brand new users, never allow changing referrer
    # afterward. The DB-level unique constraint on Referral.referred_id (see
    # models.py) additionally guarantees a referral reward can never be granted
    # twice for the same invited user, even under a race or repeated auth calls.
    start_param = (payload.start_param or data.get("start_param") or "").strip()
    if is_new_user and start_param:
        referrer = (
            await db.execute(select(User).where(User.referral_code == start_param))
        ).scalar_one_or_none()

        # Prevent self-referral: a user can never be credited for referring themself,
        # whether by telegram_id match or (defensively) by referencing their own
        # not-yet-committed row.
        if referrer and referrer.telegram_id != telegram_id and referrer.id != user.id:
            user.referred_by = referrer.id
            referrer.total_referrals += 1

            inviter_reward = Decimal(await get_setting(db, "referral_reward_inviter"))
            invited_reward = Decimal(await get_setting(db, "referral_reward_invited"))
            referrer.balance = Decimal(referrer.balance) + inviter_reward
            referrer.total_referral_earnings = Decimal(referrer.total_referral_earnings) + inviter_reward
            user.balance = Decimal(user.balance) + invited_reward

            db.add(Referral(
                referrer_id=referrer.id, referred_id=user.id,
                reward_given=True, reward_amount=inviter_reward,
            ))

    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, user=user_to_out(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user_to_out(user)
