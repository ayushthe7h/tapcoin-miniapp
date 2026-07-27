import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text,
    UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# All monetary amounts are stored as fixed-point Decimal (Numeric) columns, never
# float, to avoid rounding/precision drift. 6 decimal places gives headroom below
# the 2-decimal-place amounts shown in the UI (e.g. "12.35 USDT") while still
# representing exact values like 0.01 per tap without binary floating point error.
USDT = Numeric(18, 6, asdecimal=True)


def utcnow():
    return datetime.now(timezone.utc)


def gen_ref_code():
    return uuid.uuid4().hex[:8].upper()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    join_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    referral_code: Mapped[str] = mapped_column(String(16), unique=True, index=True, default=gen_ref_code)
    referred_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Primary in-app currency. Every balance, mining reward, leaderboard and
    # statistic in the app is denominated in USDT (see app/utils/game_settings.py).
    balance: Mapped[object] = mapped_column(USDT, default=0)

    energy: Mapped[int] = mapped_column(Integer, default=1000)
    max_energy: Mapped[int] = mapped_column(Integer, default=1000)
    last_energy_update: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Tracks the current 24h tap/energy cycle. Energy still regenerates gradually
    # (see mining.py), but this guarantees a full refill + visible countdown every
    # 24 hours, and — combined with client-side persistence fixes — progress is
    # never lost by closing or refreshing the Mini App.
    energy_cycle_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    is_mining: Mapped[bool] = mapped_column(Boolean, default=False)
    mining_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    total_referrals: Mapped[int] = mapped_column(Integer, default=0)
    total_referral_earnings: Mapped[object] = mapped_column(USDT, default=0)

    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    last_daily_claim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    daily_streak: Mapped[int] = mapped_column(Integer, default=0)

    # --- Wallet (USDT on Polygon) ---
    wallet_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # trust | okx | binance
    wallet_address: Mapped[str | None] = mapped_column(String(128), nullable=True)
    wallet_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # simple anti-cheat bookkeeping
    last_tap_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    taps_in_window: Mapped[int] = mapped_column(Integer, default=0)
    window_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    referrer = relationship("User", remote_side=[id])


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reward: Mapped[object] = mapped_column(USDT, default=0)
    button_text: Mapped[str] = mapped_column(String(64), default="Open")
    link: Mapped[str] = mapped_column(String(512))
    icon: Mapped[str | None] = mapped_column(String(256), nullable=True)
    task_type: Mapped[str] = mapped_column(String(32), default="custom_link")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CompletedTask(Base):
    __tablename__ = "completed_tasks"
    __table_args__ = (UniqueConstraint("user_id", "task_id", name="uq_user_task"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), index=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Referral(Base):
    __tablename__ = "referrals"
    __table_args__ = (UniqueConstraint("referred_id", name="uq_referred_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    referrer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    referred_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reward_given: Mapped[bool] = mapped_column(Boolean, default=False)
    # USDT credited to the referrer for this specific referral (0 if reward_given=False).
    reward_amount: Mapped[object] = mapped_column(USDT, default=0)


class MiningLog(Base):
    __tablename__ = "mining_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    taps: Mapped[int] = mapped_column(Integer)
    usdt_earned: Mapped[object] = mapped_column(USDT, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DailyReward(Base):
    __tablename__ = "daily_rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    claimed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    streak: Mapped[int] = mapped_column(Integer, default=1)
    # Daily reward is expressed in "Coins" (a fixed 0.01 USDT peg — see
    # COIN_TO_USDT_RATE in game_settings.py) but credited to the user's USDT balance.
    coins: Mapped[int] = mapped_column(Integer, default=0)
    usdt_earned: Mapped[object] = mapped_column(USDT, default=0)


class AdminUser(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(256))


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    target: Mapped[str] = mapped_column(String(32), default="all")  # all | single
    target_telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AdminLog(Base):
    __tablename__ = "admin_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_username: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
