"""Self-service account changes for signed-in customers (customer portal)."""

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.auth_session import AuthSession
from app.models.user import User


class WrongCurrentPasswordError(Exception):
    pass


def change_password(
    db: Session,
    user: User,
    *,
    current_password: str,
    new_password: str,
    keep_token: str,
) -> None:
    """Replaces the password after checking the current one.

    Every other session for this account is deleted, so a stolen session elsewhere stops
    working. The session making the request (keep_token) stays signed in.
    """
    if not verify_password(current_password, user.password_hash):
        raise WrongCurrentPasswordError
    user.password_hash = hash_password(new_password)
    db.execute(
        delete(AuthSession).where(
            AuthSession.user_id == user.id, AuthSession.token != keep_token
        )
    )
    db.commit()
