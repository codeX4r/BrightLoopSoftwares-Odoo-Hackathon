import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.models.invoice import InvoiceStatus
from app.schemas.common import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page
from app.schemas.invoice import (
    BillingRunRequest,
    BillingRunResult,
    InvoiceRead,
    InvoiceSummary,
    invoice_read,
    invoice_summary,
)
from app.services import billing_service, clock, invoice_service
from app.services.errors import InvalidInputError

router = APIRouter(tags=["staff: invoices"])


@router.get("/invoices", response_model=Page[InvoiceSummary])
def list_invoices(
    _actor: StaffOrAdmin,
    db: DbSession,
    status_filter: Annotated[InvoiceStatus | None, Query(alias="status")] = None,
    overdue: bool | None = None,
    customer_id: uuid.UUID | None = None,
    subscription_id: uuid.UUID | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[InvoiceSummary]:
    """Lists invoices, newest first. `overdue=true` lists confirmed invoices past due."""
    result = invoice_service.list_invoices(
        db,
        status=status_filter,
        overdue=overdue,
        customer_id=customer_id,
        subscription_id=subscription_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    today = clock.today()
    return Page[InvoiceSummary](
        items=[invoice_summary(i, today) for i in result.items],
        total=result.total,
        page=page,
        page_size=page_size,
    )


@router.post("/billing/run", response_model=BillingRunResult)
def run_billing(
    payload: BillingRunRequest, _actor: StaffOrAdmin, db: DbSession
) -> BillingRunResult:
    """Generates every invoice due on or before `as_of`. Safe to run repeatedly."""
    today = clock.today()
    as_of = payload.as_of or today
    if as_of > today:
        raise InvalidInputError("Billing cannot be run for a future date")
    run = billing_service.generate_due_invoices(db, as_of)
    return BillingRunResult(
        as_of=run.as_of,
        subscriptions_billed=run.subscriptions_billed,
        invoices_created=len(run.invoice_numbers),
        invoice_numbers=run.invoice_numbers,
        auto_closed=run.auto_closed,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
    invoice_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> InvoiceRead:
    return invoice_read(invoice_service.get_invoice(db, invoice_id), clock.today())


@router.post("/invoices/{invoice_id}/confirm", response_model=InvoiceRead)
def confirm_invoice(
    invoice_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> InvoiceRead:
    """DRAFT -> CONFIRMED. The invoice can then be sent and paid."""
    return invoice_read(invoice_service.confirm(db, invoice_id), clock.today())


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceRead)
def cancel_invoice(
    invoice_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> InvoiceRead:
    """Cancels an invoice that has no payments."""
    return invoice_read(invoice_service.cancel(db, invoice_id), clock.today())


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceRead)
def send_invoice(
    invoice_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> InvoiceRead:
    """Marks the invoice as sent. Emailing is not set up yet; use the print view."""
    return invoice_read(invoice_service.mark_sent(db, invoice_id), clock.today())
