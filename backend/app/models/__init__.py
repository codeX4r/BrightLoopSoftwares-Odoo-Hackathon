"""Import every ORM model here so Alembic autogenerate can see them via Base.metadata."""

from app.db.base import Base

__all__ = ["Base"]
