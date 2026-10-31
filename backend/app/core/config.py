from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Subscription Management API"
    environment: str = "development"

    # Neon connection string, e.g.
    # postgresql+psycopg://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
    database_url: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/subscription_management"
    )

    # Comma-separated list of origins allowed to call the API (the Next.js app).
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
