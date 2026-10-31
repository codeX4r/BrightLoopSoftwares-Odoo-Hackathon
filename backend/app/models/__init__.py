"""Import every ORM model here so Alembic autogenerate can see them via Base.metadata."""

from app.db.base import Base
from app.models.revoked_token import RevokedToken
from app.models.user import User, UserRole

__all__ = ["Base", "RevokedToken", "User", "UserRole"]
