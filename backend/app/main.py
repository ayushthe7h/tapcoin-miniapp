import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import select

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.models import AdminUser
from app.utils.game_settings import ensure_defaults
from app.utils.security import hash_password

from app.routers import auth, mining, daily_reward, tasks, referral, leaderboard, profile, wallet, admin as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tapcoin")

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(title="TapCoin Mini App API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(mining.router)
app.include_router(daily_reward.router)
app.include_router(tasks.router)
app.include_router(referral.router)
app.include_router(leaderboard.router)
app.include_router(profile.router)
app.include_router(wallet.router)
app.include_router(admin_router.router)


@app.on_event("startup")
async def on_startup():
    await init_db()
    async with AsyncSessionLocal() as db:
        await ensure_defaults(db)
        existing = (
            await db.execute(select(AdminUser).where(AdminUser.username == settings.ADMIN_DEFAULT_USERNAME))
        ).scalar_one_or_none()
        if not existing:
            db.add(
                AdminUser(
                    username=settings.ADMIN_DEFAULT_USERNAME,
                    password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                )
            )
            await db.commit()
            logger.warning(
                "Created default admin user '%s' — change this password immediately.",
                settings.ADMIN_DEFAULT_USERNAME,
            )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {"status": "ok"}
