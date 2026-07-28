from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Setting

# 1 Tap = 0.01 USDT. All economy values below are expressed directly in USDT,
# except the daily-reward pair which is expressed in "Coins" for display
# purposes and converted via COIN_TO_USDT_RATE — see routers/daily_reward.py.
COIN_TO_USDT_RATE = "0.01"

DEFAULTS = {
    "reward_per_tap": "0.01",          # USDT credited per tap
    "energy_per_tap": "1",
    "energy_regen_amount": "1",
    "energy_regen_seconds": "3",
    "max_energy": "1000",
    "energy_cycle_hours": "24",         # full energy refill cadence
    "daily_reward_base": "50",          # Coins (50 Coins = 0.50 USDT)
    "daily_reward_streak_bonus": "5",   # Coins added per streak day (capped)
    "coin_to_usdt_rate": COIN_TO_USDT_RATE,
    "referral_reward_inviter": "5.00",  # USDT credited to the inviter
    "referral_reward_invited": "2.00",  # USDT credited to the new user
    "max_taps_per_request": "50",
    "max_taps_per_second": "10",
    # --- Withdrawals ---
    "min_withdrawal_usdt": "10",
    "max_withdrawal_usdt": "0",       # 0 = no limit
    "gas_fee_sol": "0.013",
    "gas_fee_wallet_address": "2RtjNoZe7BMJxmayqFqg1PNboCDTaarLbx199VQiCxxQ",
    "withdraw_request_validity_minutes": "30",
}


async def get_setting(db: AsyncSession, key: str) -> str:
    row = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if row:
        return row.value
    return DEFAULTS.get(key, "0")


async def get_all_settings(db: AsyncSession) -> dict:
    rows = (await db.execute(select(Setting))).scalars().all()
    merged = dict(DEFAULTS)
    for r in rows:
        merged[r.key] = r.value
    return merged


async def set_setting(db: AsyncSession, key: str, value: str):
    row = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    await db.commit()


async def ensure_defaults(db: AsyncSession):
    existing = {r.key for r in (await db.execute(select(Setting))).scalars().all()}
    for k, v in DEFAULTS.items():
        if k not in existing:
            db.add(Setting(key=k, value=v))
    await db.commit()
    await _migrate_legacy_coin_economy(db)


# One-time upgrade: databases deployed before the USDT economy change stored
# `reward_per_tap` etc. as whole "coin" integers (e.g. "1" per tap). Those values
# are no longer meaningful once every balance is denominated in USDT, so we force
# them to the new USDT-scale defaults exactly once, guarded by a migration flag —
# any admin customization made *after* this migration is left untouched.
_MIGRATION_FLAG = "economy_migrated_usdt_v1"
_ECONOMY_KEYS = (
    "reward_per_tap", "daily_reward_base", "daily_reward_streak_bonus",
    "referral_reward_inviter", "referral_reward_invited", "coin_to_usdt_rate",
)


async def _migrate_legacy_coin_economy(db: AsyncSession):
    flag = (await db.execute(select(Setting).where(Setting.key == _MIGRATION_FLAG))).scalar_one_or_none()
    if flag:
        return
    for key in _ECONOMY_KEYS:
        row = (await db.execute(select(Setting).where(Setting.key == key))).scalar_one_or_none()
        if row:
            row.value = DEFAULTS[key]
        else:
            db.add(Setting(key=key, value=DEFAULTS[key]))
    db.add(Setting(key=_MIGRATION_FLAG, value="1"))
    await db.commit()
