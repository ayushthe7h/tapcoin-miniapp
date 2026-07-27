from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import settings

IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

# SQLite (aiosqlite) needs check_same_thread=False and a single shared connection
# (StaticPool) to behave under the async event loop — none of that applies to a
# networked DB like Postgres, which manages its own connection pool.
_engine_kwargs = {"echo": False}
if IS_SQLITE:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["poolclass"] = StaticPool

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


if IS_SQLITE:
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_pragmas(dbapi_connection, connection_record):
        """Enforce foreign keys and use WAL mode for better concurrent read/write behavior."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """
    Creates all tables if they don't exist yet (on SQLite, this also creates the
    tapcoin.db file). Runs automatically on app startup — see main.py's startup
    event. For schema changes after the first launch, prefer Alembic migrations
    over relying on create_all in a real production rollout.

    IMPORTANT (Render / any host with an ephemeral filesystem): SQLite is a
    single on-disk file, so if DATABASE_URL points at sqlite and the platform
    wipes the filesystem on every deploy/restart, every user's data — energy,
    balance, everything — resets too. Point DATABASE_URL at a real Postgres
    instance (e.g. Render's managed Postgres) for anything persistent.
    """
    async with engine.begin() as conn:
        from app import models  # noqa: F401  (ensure models are registered before create_all)
        await conn.run_sync(Base.metadata.create_all)
        if IS_SQLITE:
            # The additive-column migration below is SQLite-specific (PRAGMA
            # table_info). A fresh Postgres database already gets the current
            # schema straight from create_all above, so there's nothing to migrate.
            await conn.run_sync(_run_lightweight_migrations)


def _run_lightweight_migrations(sync_conn):
    """
    Idempotent, additive schema upgrade for SQLite databases created by earlier
    versions of this app (coin-based economy). Safe to run on every startup:
    every statement first checks whether it's needed via PRAGMA table_info.

    This intentionally avoids a full Alembic migration chain since the project
    bootstraps its schema with `create_all` rather than versioned migrations;
    if you introduce Alembic revisions later, fold this logic into the first one.
    """
    insp_cols = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
    }
    if not insp_cols:
        return  # fresh DB, create_all already produced the current schema

    # Rename the old integer `coins` column into the new USDT `balance` column.
    if "coins" in insp_cols and "balance" not in insp_cols:
        sync_conn.exec_driver_sql("ALTER TABLE users RENAME COLUMN coins TO balance")
        insp_cols.discard("coins")
        insp_cols.add("balance")

    additive_user_columns = {
        "balance": "NUMERIC(18,6) NOT NULL DEFAULT 0",
        "total_referral_earnings": "NUMERIC(18,6) NOT NULL DEFAULT 0",
        "energy_cycle_started_at": "DATETIME",
        "wallet_type": "VARCHAR(32)",
        "wallet_address": "VARCHAR(128)",
        "wallet_connected_at": "DATETIME",
    }
    for col, ddl in additive_user_columns.items():
        if col not in insp_cols:
            sync_conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col} {ddl}")

    referral_cols = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(referrals)").fetchall()
    }
    if referral_cols and "reward_amount" not in referral_cols:
        sync_conn.exec_driver_sql(
            "ALTER TABLE referrals ADD COLUMN reward_amount NUMERIC(18,6) NOT NULL DEFAULT 0"
        )

    mining_cols = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(mining_logs)").fetchall()
    }
    if mining_cols:
        if "coins_earned" in mining_cols and "usdt_earned" not in mining_cols:
            sync_conn.exec_driver_sql(
                "ALTER TABLE mining_logs RENAME COLUMN coins_earned TO usdt_earned"
            )
        elif "usdt_earned" not in mining_cols:
            sync_conn.exec_driver_sql(
                "ALTER TABLE mining_logs ADD COLUMN usdt_earned NUMERIC(18,6) NOT NULL DEFAULT 0"
            )

    daily_cols = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(daily_rewards)").fetchall()
    }
    if daily_cols:
        if "reward" in daily_cols and "coins" not in daily_cols:
            sync_conn.exec_driver_sql("ALTER TABLE daily_rewards RENAME COLUMN reward TO coins")
            daily_cols.discard("reward")
            daily_cols.add("coins")
        if "usdt_earned" not in daily_cols:
            sync_conn.exec_driver_sql(
                "ALTER TABLE daily_rewards ADD COLUMN usdt_earned NUMERIC(18,6) NOT NULL DEFAULT 0"
            )