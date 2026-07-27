from app.models import User
from app.schemas import UserOut


def user_to_out(user: User) -> UserOut:
    """Builds the public UserOut shape from a User ORM row. Kept as a shared
    helper (rather than UserOut.model_validate(user, from_attributes=True))
    because a couple of fields — wallet_connected — are derived, not columns."""
    return UserOut(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        photo_url=user.photo_url,
        balance=float(user.balance),
        energy=user.energy,
        max_energy=user.max_energy,
        referral_code=user.referral_code,
        total_referrals=user.total_referrals,
        total_referral_earnings=float(user.total_referral_earnings),
        is_banned=user.is_banned,
        wallet_type=user.wallet_type,
        wallet_address=user.wallet_address,
        wallet_connected=bool(user.wallet_address),
    )
