from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, AdminUser
from app.utils.security import decode_access_token, InitDataError

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing credentials")
    try:
        payload = decode_access_token(creds.credentials)
    except InitDataError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = (await db.execute(select(User).where(User.id == int(user_id)))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if user.is_banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account banned")
    return user


async def get_current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing credentials")
    try:
        payload = decode_access_token(creds.credentials, secret=settings.ADMIN_JWT_SECRET)
    except InitDataError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))

    if payload.get("type") != "admin":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token")

    admin_id = payload.get("sub")
    admin = (await db.execute(select(AdminUser).where(AdminUser.id == int(admin_id)))).scalar_one_or_none()
    if admin is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
    return admin
