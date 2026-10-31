"""Company details printed on quotations and invoices.

Any signed-in user can read them (staff print quotations and invoices, customers print
their own invoices). Only the admin can change them, under /api/admin/settings.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.db.session import DbSession
from app.services import settings_service

router = APIRouter(prefix="/api/company", tags=["company"])


class CompanyRead(BaseModel):
    name: str
    address: str | None
    email: str | None
    phone: str | None


@router.get("", response_model=CompanyRead)
def get_company(_user: CurrentUser, db: DbSession) -> CompanyRead:
    row = settings_service.get_settings_row(db)
    return CompanyRead(
        name=row.company_name,
        address=row.company_address,
        email=row.company_email,
        phone=row.company_phone,
    )
