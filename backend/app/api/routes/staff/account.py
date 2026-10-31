"""Account settings for staff (and admin) users. Added by the customer-portal developer;
shares its logic with /api/portal/account/password via app.api.password_change."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api import password_change
from app.api.deps import CurrentAuth
from app.core.rate_limit import LoginRateLimiter, get_login_rate_limiter
from app.db.session import DbSession
from app.models.user import UserRole
from app.schemas.account import StaffPasswordChangeRequest

router = APIRouter(prefix="/account", tags=["staff: account"])

ALLOWED_ROLES = frozenset({UserRole.STAFF, UserRole.ADMIN})


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=password_change.RESPONSES,
)
def change_password(
    payload: StaffPasswordChangeRequest,
    auth: CurrentAuth,
    request: Request,
    db: DbSession,
    limiter: Annotated[LoginRateLimiter, Depends(get_login_rate_limiter)],
) -> None:
    """Staff or admin sets a new password after confirming the current one.

    The new password needs at least 12 characters plus an uppercase letter, a lowercase
    letter and a special character.
    """
    if auth.user.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )
    password_change.change_password(payload, auth, request, db, limiter)
