"""Password hashing (Argon2id) and random session tokens."""

import secrets
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2-cffi defaults follow the RFC 9106 low-memory Argon2id profile.
_password_hasher = PasswordHasher()


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


def create_session_token() -> str:
    """Random token stored in auth_sessions and sent to the browser in the auth cookie."""
    return secrets.token_urlsafe(32)
