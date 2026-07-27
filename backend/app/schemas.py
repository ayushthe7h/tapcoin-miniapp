from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class TelegramAuthRequest(BaseModel):
    init_data: str
    start_param: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    photo_url: str | None
    balance: float
    energy: int
    max_energy: int
    referral_code: str
    total_referrals: int
    total_referral_earnings: float
    is_banned: bool
    wallet_type: str | None = None
    wallet_address: str | None = None
    wallet_connected: bool = False

    class Config:
        from_attributes = True


class TapRequest(BaseModel):
    taps: int = Field(gt=0, le=10000)
    client_ts: int | None = None  # client timestamp (ms), advisory only, never trusted for balance


class MiningStatusOut(BaseModel):
    balance: float
    energy: int
    max_energy: int
    reward_per_tap: float
    energy_per_tap: int
    energy_regen_amount: int
    energy_regen_seconds: int
    energy_reset_at: datetime  # next full 24h refill — countdown target on the client


class DailyRewardStatusOut(BaseModel):
    can_claim: bool
    next_claim_at: datetime | None
    current_streak: int
    reward_coins: int
    reward_usdt: float


class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    reward: float
    button_text: str
    link: str
    icon: str | None
    task_type: str
    completed: bool

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    reward: float = 0
    button_text: str = "Open"
    link: str
    icon: str | None = None
    task_type: str = "custom_link"


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    reward: float | None = None
    button_text: str | None = None
    link: str | None = None
    icon: str | None = None
    task_type: str | None = None
    is_active: bool | None = None


class ReferralOut(BaseModel):
    referral_code: str
    referral_link: str
    total_referrals: int
    total_referral_earnings: float
    reward_per_referral: float


class ReferralHistoryEntry(BaseModel):
    username: str | None
    first_name: str | None
    reward_amount: float
    created_at: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    username: str | None
    first_name: str | None
    value: float


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminUserEditRequest(BaseModel):
    balance: float | None = None
    energy: int | None = None
    total_referrals: int | None = None
    is_banned: bool | None = None


class AdminSettingsUpdate(BaseModel):
    settings: dict[str, str]


class BroadcastRequest(BaseModel):
    title: str
    message: str
    target: str = "all"
    target_telegram_id: int | None = None


SUPPORTED_WALLETS = ("trust", "okx", "binance")

# USDT on Polygon uses the standard EVM (checksummed hex) address format.
EVM_ADDRESS_PATTERN = r"^0x[a-fA-F0-9]{40}$"


class WalletConnectRequest(BaseModel):
    wallet_type: str
    address: str

    @field_validator("wallet_type")
    @classmethod
    def _valid_wallet_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in SUPPORTED_WALLETS:
            raise ValueError(f"Unsupported wallet. Choose one of: {', '.join(SUPPORTED_WALLETS)}")
        return v

    @field_validator("address")
    @classmethod
    def _valid_address(cls, v: str) -> str:
        import re
        v = v.strip()
        if not re.match(EVM_ADDRESS_PATTERN, v):
            raise ValueError("Invalid USDT (Polygon) address — expected a 42-character 0x… address")
        return v


class WalletOut(BaseModel):
    balance: float
    wallet_type: str | None
    wallet_address: str | None
    wallet_connected: bool
    wallet_connected_at: datetime | None
