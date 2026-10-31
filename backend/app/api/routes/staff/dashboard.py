from datetime import date

from fastapi import APIRouter

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.schemas.dashboard import StaffDashboard
from app.services import dashboard_service
from app.services.errors import InvalidInputError

router = APIRouter(prefix="/dashboard", tags=["staff: dashboard"])


@router.get("", response_model=StaffDashboard)
def staff_dashboard(
    _actor: StaffOrAdmin,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
) -> StaffDashboard:
    """Subscription, invoice and payment totals. Dates filter the revenue figures."""
    if date_from and date_to and date_from > date_to:
        raise InvalidInputError("date_from must be on or before date_to")
    return dashboard_service.staff_dashboard(db, date_from=date_from, date_to=date_to)
