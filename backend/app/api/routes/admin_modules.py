"""Admin-only APIs for taxes, discounts, reports and settings, under /api/admin.

Every route requires an ADMIN (router-level dependency, checked on the server).
"""

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import require_roles
from app.db.session import DbSession
from app.models.discount import Discount, DiscountType
from app.models.tax import Tax
from app.models.user import UserRole
from app.schemas.admin_modules import (
    DiscountCreate,
    DiscountPreview,
    DiscountPreviewRequest,
    DiscountRead,
    DiscountUpdate,
    NamedRef,
    RevenuePeriod,
    RevenueReportRead,
    SettingsRead,
    SettingsUpdate,
    SubscriptionReportRead,
    TaxCreate,
    TaxRead,
    TaxUpdate,
)
from app.schemas.catalog import Page
from app.services import (
    clock,
    discount_service,
    report_service,
    settings_service,
    tax_service,
)
from app.services.errors import InvalidInputError
from app.services.money import ZERO, line_amounts, round_money

router = APIRouter(
    prefix="/api/admin",
    tags=["admin: taxes, discounts, reports, settings"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)

Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Search = Annotated[str | None, Query(max_length=100)]

RECURRING_DEFINITION = (
    "PROPOSED: monthly-equivalent pre-tax value of active, unexpired subscriptions. "
    "Line subtotals are scaled by billing frequency: daily x 365/12, weekly x 52/12, "
    "monthly x 1, yearly / 12. Not the same as invoiced or received amounts."
)


# --- Taxes -------------------------------------------------------------------


def tax_read(tax: Tax) -> TaxRead:
    return TaxRead(
        id=tax.id,
        name=tax.name,
        rate=tax.rate,
        tax_type=tax.tax_type,
        description=tax.description,
        is_active=tax.is_active,
        is_default=tax.is_default,
        products=[NamedRef(id=p.id, name=p.name) for p in tax.products],
        product_types=[NamedRef(id=t.id, name=t.name) for t in tax.product_types],
        created_at=tax.created_at,
        updated_at=tax.updated_at,
    )


@router.get("/taxes", response_model=Page[TaxRead])
def list_taxes(
    db: DbSession,
    q: Search = None,
    is_active: bool | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[TaxRead]:
    items, total = tax_service.list_taxes(
        db, q=q, is_active=is_active, limit=limit, offset=offset
    )
    return Page[TaxRead](
        items=[tax_read(t) for t in items], total=total, limit=limit, offset=offset
    )


@router.post("/taxes", response_model=TaxRead, status_code=status.HTTP_201_CREATED)
def create_tax(payload: TaxCreate, db: DbSession) -> TaxRead:
    return tax_read(tax_service.create_tax(db, **payload.model_dump()))


@router.get("/taxes/{tax_id}", response_model=TaxRead)
def get_tax(tax_id: uuid.UUID, db: DbSession) -> TaxRead:
    return tax_read(tax_service.get_tax(db, tax_id))


@router.patch("/taxes/{tax_id}", response_model=TaxRead)
def update_tax(tax_id: uuid.UUID, payload: TaxUpdate, db: DbSession) -> TaxRead:
    tax = tax_service.get_tax(db, tax_id)
    return tax_read(
        tax_service.update_tax(db, tax, payload.model_dump(exclude_unset=True))
    )


# --- Discounts ---------------------------------------------------------------


def discount_read(discount: Discount, today: date) -> DiscountRead:
    return DiscountRead(
        id=discount.id,
        name=discount.name,
        description=discount.description,
        discount_type=discount.discount_type,
        value=discount.value,
        min_purchase_amount=discount.min_purchase_amount,
        min_quantity=discount.min_quantity,
        start_date=discount.start_date,
        end_date=discount.end_date,
        usage_limit=discount.usage_limit,
        usage_count=discount.usage_count,
        scope=discount.scope,
        products=[NamedRef(id=p.id, name=p.name) for p in discount.products],
        is_active=discount.is_active,
        is_valid_today=discount_service.is_valid_on(discount, today),
        created_at=discount.created_at,
        updated_at=discount.updated_at,
    )


@router.get("/discounts", response_model=Page[DiscountRead])
def list_discounts(
    db: DbSession,
    q: Search = None,
    is_active: bool | None = None,
    discount_type: DiscountType | None = None,
    valid_today: bool = False,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[DiscountRead]:
    today = clock.today()
    items, total = discount_service.list_discounts(
        db,
        q=q,
        is_active=is_active,
        discount_type=discount_type,
        valid_on=today if valid_today else None,
        limit=limit,
        offset=offset,
    )
    return Page[DiscountRead](
        items=[discount_read(d, today) for d in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/discounts", response_model=DiscountRead, status_code=status.HTTP_201_CREATED
)
def create_discount(payload: DiscountCreate, db: DbSession) -> DiscountRead:
    discount = discount_service.create_discount(db, **payload.model_dump())
    return discount_read(discount, clock.today())


@router.get("/discounts/{discount_id}", response_model=DiscountRead)
def get_discount(discount_id: uuid.UUID, db: DbSession) -> DiscountRead:
    return discount_read(discount_service.get_discount(db, discount_id), clock.today())


@router.patch("/discounts/{discount_id}", response_model=DiscountRead)
def update_discount(
    discount_id: uuid.UUID, payload: DiscountUpdate, db: DbSession
) -> DiscountRead:
    discount = discount_service.get_discount(db, discount_id)
    updated = discount_service.update_discount(
        db, discount, payload.model_dump(exclude_unset=True)
    )
    return discount_read(updated, clock.today())


@router.post("/discounts/preview", response_model=DiscountPreview)
def preview_discount(payload: DiscountPreviewRequest, db: DbSession) -> DiscountPreview:
    """Which discount would apply to these lines on a date, and by how much (no side effects)."""
    as_of = payload.as_of or clock.today()
    lines = []
    for line in payload.lines:
        subtotal = line_amounts(line.quantity, line.unit_price, ZERO).subtotal
        lines.append(
            discount_service.LineInput(
                product_id=line.product_id, quantity=line.quantity, subtotal=subtotal
            )
        )
    subtotal = round_money(sum((line.subtotal for line in lines), ZERO))
    result = discount_service.evaluate(db, lines, as_of)
    amount = result.amount if result else ZERO
    return DiscountPreview(
        as_of=as_of,
        subtotal=subtotal,
        discount=NamedRef(id=result.discount.id, name=result.discount.name)
        if result
        else None,
        discount_amount=amount,
        subtotal_after_discount=subtotal - amount,
    )


# --- Reports -----------------------------------------------------------------


def _range(date_from: date | None, date_to: date | None) -> tuple[date, date]:
    today = clock.today()
    end = date_to or today
    start = date_from or date(end.year, 1, 1)
    if start > end:
        raise InvalidInputError("date_from must be on or before date_to")
    if (end - start).days > 366 * 10:
        raise InvalidInputError("The date range can be at most 10 years.")
    return start, end


@router.get("/reports/revenue", response_model=RevenueReportRead)
def revenue_report(
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
    group_by: Literal["month", "year"] = "month",
) -> RevenueReportRead:
    """Invoiced vs received vs outstanding vs overdue. Defaults to this year so far."""
    start, end = _range(date_from, date_to)
    report = report_service.revenue_report(
        db, date_from=start, date_to=end, group_by=group_by, today=clock.today()
    )
    return RevenueReportRead(
        **{k: v for k, v in report.__dict__.items() if k != "periods"},
        periods=[RevenuePeriod(**p.__dict__) for p in report.periods],
    )


@router.get("/reports/subscriptions", response_model=SubscriptionReportRead)
def subscription_report(
    db: DbSession, date_from: date | None = None, date_to: date | None = None
) -> SubscriptionReportRead:
    start, end = _range(date_from, date_to)
    report = report_service.subscription_report(
        db, date_from=start, date_to=end, today=clock.today()
    )
    return SubscriptionReportRead(
        **report.__dict__, recurring_revenue_definition=RECURRING_DEFINITION
    )


# --- Settings ----------------------------------------------------------------


def settings_read(db: DbSession) -> SettingsRead:
    row = settings_service.get_settings_row(db)
    return SettingsRead(
        company_name=row.company_name,
        company_address=row.company_address,
        company_email=row.company_email,
        company_phone=row.company_phone,
        currency=row.currency,
        timezone=row.timezone,
        invoice_prefix=row.invoice_prefix,
        updated_at=row.updated_at,
        supported_currencies=sorted(settings_service.SUPPORTED_CURRENCIES),
        supported_timezones=sorted(settings_service.SUPPORTED_TIMEZONES),
    )


@router.get("/settings", response_model=SettingsRead)
def get_settings(db: DbSession) -> SettingsRead:
    return settings_read(db)


@router.patch("/settings", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate, db: DbSession) -> SettingsRead:
    settings_service.update_settings(db, payload.model_dump(exclude_unset=True))
    return settings_read(db)
