import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


class InitDataError(Exception):
    pass


def parse_and_verify_init_data(init_data: str) -> dict:
    """
    Verifies Telegram WebApp initData per the official algorithm:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

    Raises InitDataError if the signature is invalid, missing, or expired.
    Never trusts any field without verifying the hash first.
    """
    if not init_data:
        raise InitDataError("Missing init data")

    pairs = dict(parse_qsl(init_data, strict_parsing=False))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise InitDataError("Missing hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))

    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise InitDataError("Invalid signature")

    auth_date = pairs.get("auth_date")
    if auth_date:
        age = time.time() - int(auth_date)
        if age > settings.INIT_DATA_MAX_AGE_SECONDS:
            raise InitDataError("Init data expired")

    return pairs


def create_access_token(data: dict, expires_minutes: int | None = None, secret: str | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret or settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str, secret: str | None = None) -> dict:
    try:
        return jwt.decode(token, secret or settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise InitDataError(f"Invalid token: {e}")
