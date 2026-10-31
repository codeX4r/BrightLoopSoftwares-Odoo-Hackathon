"""Authentication and role-based authorization dependencies."""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.db.session import DbSession
from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
from app.services import auth_service, user_service

# auto_error=False so a missing header falls through to the cookie check.
bearer_scheme = HTTPBearer(auto_error=False)

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
CSRF_HEADER = "X-Requested-With"


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


@dataclass(frozen=True)
class AuthContext:
    user: User
    session: AuthSession


def get_auth_context(
    request: Request,
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthContext:
    """Resolves the caller from a Bearer header or the auth cookie."""
    settings = get_settings()
    from_cookie = False
    if credentials is not None:
        token = credentials.credentials
    else:
        token = request.cookies.get(settings.auth_cookie_name)
        from_cookie = True
    if not token:
        raise _unauthorized()

    # Browsers attach cookies automatically, so require a custom header on cookie-authed
    # writes. Cross-site pages can't send it without passing the CORS preflight.
    if (
        from_cookie
        and request.method not in SAFE_METHODS
        and not request.headers.get(CSRF_HEADER)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Missing CSRF header"
        )

    session = auth_service.get_active_session(db, token)
    if session is None:
        raise _unauthorized("Invalid or expired session")

    user = user_service.get_user_by_id(db, session.user_id)
    if user is None or not user.is_active:
        raise _unauthorized("Invalid or expired session")

    return AuthContext(user=user, session=session)


def get_current_user(
    context: Annotated[AuthContext, Depends(get_auth_context)],
) -> User:
    return context.user


CurrentAuth = Annotated[AuthContext, Depends(get_auth_context)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    """Dependency factory that allows only the given roles, using the role from the database."""
    allowed = frozenset(roles)

    def dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return dependency


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
