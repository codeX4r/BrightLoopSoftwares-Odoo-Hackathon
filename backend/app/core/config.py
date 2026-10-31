from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
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

    # --- Authentication ---
    # Session lifetime. Sessions are random tokens stored in the auth_sessions table.
    access_token_expire_minutes: int = Field(default=30, ge=1, le=24 * 60)

    # The session token is also set as an HttpOnly cookie so browser JS never reads it.
    auth_cookie_name: str = "access_token"
    # None means "Secure unless ENVIRONMENT=development".
    auth_cookie_secure: bool | None = None
    # Use "none" (with Secure) only if the frontend and API are on different sites.
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_cookie_domain: str | None = None

    # Brute-force protection: failed logins allowed per window, per email and per client IP.
    login_max_failures_per_email: int = Field(default=5, ge=1)
    login_max_failures_per_ip: int = Field(default=20, ge=1)
    login_failure_window_seconds: int = Field(default=15 * 60, ge=1)

    # --- Password reset ---
    password_reset_token_minutes: int = Field(default=30, ge=5, le=24 * 60)
    # Reset requests allowed per window, per email and per client IP.
    password_reset_max_per_email: int = Field(default=3, ge=1)
    password_reset_max_per_ip: int = Field(default=10, ge=1)
    password_reset_window_seconds: int = Field(default=15 * 60, ge=1)
    # Base URL of the frontend, used to build the link in the reset email.
    frontend_url: str = "http://localhost:3000"

    # --- Email delivery ---
    # "console" logs emails (development only); "smtp" sends them through SMTP_*.
    email_backend: Literal["console", "smtp"] = "console"
    email_from: str = "Brightloop Software <no-reply@brightloop.local>"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_use_tls: bool = True

    @property
    def cookie_secure(self) -> bool:
        if self.auth_cookie_secure is not None:
            return self.auth_cookie_secure
        return self.environment != "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
