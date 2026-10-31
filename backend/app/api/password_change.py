"""Shared request handling for "change password with the current password".

Used by the customer portal (/api/portal/account/password) and the staff panel
(/api/staff/account/password). Each route does its own role check and request schema.
"""

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import AuthContext
from app.core.rate_limit import LoginRateLimiter
from app.schemas.account import PasswordChangeRequest
from app.services import account_service

WRONG_CURRENT_PASSWORD = "Your current password is incorrect"

RESPONSES: dict[int | str, dict[str, str]] = {
    400: {"description": "Current password is incorrect"},
    403: {"description": "Role not allowed"},
    422: {"description": "New password is too weak or unchanged"},
    429: {"description": "Too many wrong attempts"},
}


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def change_password(
    payload: PasswordChangeRequest,
    auth: AuthContext,
    request: Request,
    db: Session,
    limiter: LoginRateLimiter,
) -> None:
    """Checks the current password and sets the new one.

    Wrong current passwords count toward the same per-email and per-IP limits as failed
    logins, so a session can't be used to guess the password. On success, the account's
    other sessions are signed out and this one stays signed in.
    """
    email = auth.user.email
    ip = _client_ip(request)
    retry_after = limiter.retry_after(email, ip)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many wrong attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    try:
        account_service.change_password(
            db,
            auth.user,
            current_password=payload.current_password,
            new_password=payload.new_password,
            keep_token=auth.session.token,
        )
    except account_service.WrongCurrentPasswordError:
        limiter.record_failure(email, ip)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=WRONG_CURRENT_PASSWORD
        ) from None
    limiter.record_success(email)
