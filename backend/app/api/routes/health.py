from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import DbSession

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: DbSession) -> dict[str, str]:
    """Checks that the database is reachable."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
