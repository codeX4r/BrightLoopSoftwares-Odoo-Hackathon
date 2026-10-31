"""Customer account settings for the customer portal. Owned by the customer-portal developer."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api import password_change
from app.api.deps import CurrentAuth
from app.core.rate_limit import LoginRateLimiter, get_login_rate_limiter
from app.db.session import DbSession
from app.models.user import UserRole
from app.schemas.account import PasswordChangeRequest

router = APIRouter(prefix="/account", tags=["portal (customer): account"])


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=password_change.RESPONSES,
)
def change_password(
    payload: PasswordChangeRequest,
    auth: CurrentAuth,
    request: Request,
    db: DbSession,
    limiter: Annotated[LoginRateLimiter, Depends(get_login_rate_limiter)],
) -> None:
    """Customer sets a new password after confirming the current one (signup password rule)."""
    if auth.user.role != UserRole.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )
    password_change.change_password(payload, auth, request, db, limiter)
