from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models.

    Models must be imported in app/models/__init__.py so Alembic can detect them.
    """
