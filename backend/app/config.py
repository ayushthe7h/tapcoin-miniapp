from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    BOT_TOKEN: str
    BOT_USERNAME: str = ""

    # SQLite file, created automatically on first launch. Override in .env only if you
    # need a different path — no other database engine is supported.
    DATABASE_URL: str = "sqlite+aiosqlite:///./tapcoin.db"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 43200

    ADMIN_JWT_SECRET: str
    ADMIN_DEFAULT_USERNAME: str = "admin"
    ADMIN_DEFAULT_PASSWORD: str = "change_me"

    ENV: str = "production"
    CORS_ORIGINS: str = "*"
    INIT_DATA_MAX_AGE_SECONDS: int = 86400

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
