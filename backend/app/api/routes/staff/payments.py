import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.models.payment import PaymentMethod
from app.schemas.common import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page
from app.schemas.payment import PaymentCreate, PaymentRead, payment_read
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["staff: payments"])


@router.get("", response_model=Page[PaymentRead])
def list_payments(
    _actor: StaffOrAdmin,
    db: DbSession,
    invoice_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    method: PaymentMethod | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[PaymentRead]:
    result = payment_service.list_payments(
        db,
        invoice_id=invoice_id,
        customer_id=customer_id,
        method=method,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return Page[PaymentRead](
        items=[payment_read(p) for p in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def record_payment(
    payload: PaymentCreate, actor: StaffOrAdmin, db: DbSession
) -> PaymentRead:
    """Records a payment on a confirmed invoice. The invoice becomes PAID when settled."""
    return payment_read(payment_service.record_payment(db, payload, actor=actor))
