from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import CurrentUser, bearer_scheme, get_auth_context
from app.core.config import get_settings
from app.core.rate_limit import LoginRateLimiter, get_login_rate_limiter
from app.db.session import DbSession
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.user import UserRead
from app.services import auth_service
from app.services.user_service import normalize_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

INVALID_CREDENTIALS = "Invalid email or password"


def _client_ip(request: Request) -> str:
    # Behind a reverse proxy, run uvicorn with --proxy-headers so this is the real client.
    return request.client.host if request.client else "unknown"


def _set_auth_cookie(response: Response, token: str, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=max_age,
        path="/",
        domain=settings.auth_cookie_domain,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )


def _clear_auth_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        domain=settings.auth_cookie_domain,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        401: {"description": "Invalid credentials"},
        429: {"description": "Too many attempts"},
    },
)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
    limiter: Annotated[LoginRateLimiter, Depends(get_login_rate_limiter)],
) -> LoginResponse:
    """Exchanges email and password for a session token.

    The role in the response comes from the database. If the client sends a role (the
    login page's role selector), it must match the stored role or the login fails.
    """
    email = normalize_email(payload.email)
    ip = _client_ip(request)

    retry_after = limiter.retry_after(email, ip)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    user = auth_service.authenticate(db, email, payload.password)
    # A wrong role selection gets the same response as a wrong password, so the login
    # page can't be used to discover which role an account has.
    if user is not None and payload.role is not None and payload.role != user.role:
        user = None
    if user is None:
        limiter.record_failure(email, ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )
    limiter.record_success(email)

    session = auth_service.create_session(db, user)
    expires_in = get_settings().access_token_expire_minutes * 60
    _set_auth_cookie(response, session.token, expires_in)
    response.headers["Cache-Control"] = "no-store"
    return LoginResponse(
        access_token=session.token,
        expires_in=expires_in,
        user_id=user.id,
        email=user.email,
        role=user.role,
    )


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Response:
    """Deletes the current session and clears the auth cookie.

    Succeeds even if the session is already invalid, so the client can always sign out.
    """
    try:
        context = get_auth_context(request, db, credentials)
    except HTTPException as exc:
        if exc.status_code != status.HTTP_401_UNAUTHORIZED:
            raise
    else:
        auth_service.delete_session(db, context.session.token)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookie(response)
    return response
