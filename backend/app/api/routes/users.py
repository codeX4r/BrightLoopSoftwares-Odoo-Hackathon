import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import AdminUser, CurrentUser
from app.db.session import DbSession
from app.models.user import UserRole
from app.schemas.user import UserCreate, UserRead, UserStatusUpdate
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])

USER_NOT_FOUND = "User not found"


@router.post("/staff", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_staff(payload: UserCreate, _admin: AdminUser, db: DbSession) -> UserRead:
    """Creates a STAFF account. Admin only."""
    try:
        user = user_service.create_user(
            db, email=payload.email, password=payload.password, role=UserRole.STAFF
        )
    except user_service.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        ) from None
    return UserRead.model_validate(user)


@router.get("/staff", response_model=list[UserRead])
def list_staff(_admin: AdminUser, db: DbSession) -> list[UserRead]:
    """Lists STAFF accounts. Admin only."""
    return [
        UserRead.model_validate(u)
        for u in user_service.list_users_by_role(db, UserRole.STAFF)
    ]


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: uuid.UUID, actor: CurrentUser, db: DbSession) -> UserRead:
    """Returns a user profile the caller is allowed to see.

    Customers can only read their own profile. Inaccessible users return 404, the same as
    missing ones, so IDs of other accounts can't be probed.
    """
    target = user_service.get_user_by_id(db, user_id)
    if target is None or not user_service.can_view_user(actor, target):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=USER_NOT_FOUND
        )
    return UserRead.model_validate(target)


@router.patch("/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: uuid.UUID, payload: UserStatusUpdate, admin: AdminUser, db: DbSession
) -> UserRead:
    """Activates or deactivates an account. Admin only.

    Deactivation takes effect immediately: existing tokens stop working on the next request.
    """
    target = user_service.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=USER_NOT_FOUND
        )
    if target.id == admin.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )
    user = user_service.set_user_active(db, target, is_active=payload.is_active)
    return UserRead.model_validate(user)
