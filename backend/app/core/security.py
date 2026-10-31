"""Password hashing (Argon2id) and JWT access-token helpers."""

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

# argon2-cffi defaults follow the RFC 9106 low-memory Argon2id profile.
_password_hasher = PasswordHasher()

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _password_hasher.check_needs_rehash(password_hash)


@lru_cache
def _dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def verify_dummy_password(password: str) -> None:
    """Spend the same time as a real check so unknown emails can't be detected by timing."""
    verify_password(password, _dummy_password_hash())


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    jti: str
    expires_at: datetime


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """Returns a signed JWT and its lifetime in seconds.

    The role is deliberately not trusted from the token; it is re-read from the database
    on every request so role changes and deactivation take effect immediately.
    """
    settings = get_settings()
    lifetime = timedelta(minutes=settings.access_token_expire_minutes)
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + lifetime,
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> AccessTokenClaims:
    """Validates signature, expiry and required claims. Raises jwt.InvalidTokenError."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "jti", "exp", "iat", "type"]},
    )
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise jwt.InvalidTokenError("Unexpected token type")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("Invalid subject") from exc
    return AccessTokenClaims(
        user_id=user_id,
        jti=str(payload["jti"]),
        expires_at=datetime.fromtimestamp(payload["exp"], UTC),
    )
