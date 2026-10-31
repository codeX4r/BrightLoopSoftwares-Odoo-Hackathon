"""Quotation templates: reusable plan + lines + validity, used to start new quotations."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.models.quotation_template import QuotationTemplate
from app.models.subscription import BillingFrequency
from app.schemas.common import OptionalNotes, ShortText
from app.schemas.subscription import MAX_LINES, SubscriptionLineIn, ValidityDays
from app.services import template_service
from app.services.money import ZERO, line_amounts

router = APIRouter(prefix="/quotation-templates", tags=["staff: quotation templates"])


class TemplateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ShortText
    description: OptionalNotes = None
    plan_id: uuid.UUID | None = None
    plan_name: ShortText | None = None
    billing_frequency: BillingFrequency | None = None
    validity_days: ValidityDays = 15
    payment_terms_days: int = Field(default=15, ge=0, le=365)
    notes: OptionalNotes = None
    is_active: bool = True
    lines: list[SubscriptionLineIn] = Field(default_factory=list, max_length=MAX_LINES)


class TemplateLineRead(BaseModel):
    id: uuid.UUID
    is_plan_line: bool
    product_id: uuid.UUID | None
    variant_id: uuid.UUID | None
    description: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    total: Decimal


class TemplateRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    plan_id: uuid.UUID | None
    plan_name: str
    billing_frequency: BillingFrequency
    validity_days: int
    payment_terms_days: int
    notes: str | None
    is_active: bool
    total: Decimal
    lines: list[TemplateLineRead]
    updated_at: datetime


def template_read(t: QuotationTemplate) -> TemplateRead:
    lines = []
    total = ZERO
    for line in t.lines:
        amounts = line_amounts(line.quantity, line.unit_price, line.tax_rate)
        total += amounts.total
        lines.append(
            TemplateLineRead(
                id=line.id,
                is_plan_line=line.is_plan_line,
                product_id=line.product_id,
                variant_id=line.variant_id,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                tax_rate=line.tax_rate,
                total=amounts.total,
            )
        )
    return TemplateRead(
        id=t.id,
        name=t.name,
        description=t.description,
        plan_id=t.plan_id,
        plan_name=t.plan_name,
        billing_frequency=t.billing_frequency,
        validity_days=t.validity_days,
        payment_terms_days=t.payment_terms_days,
        notes=t.notes,
        is_active=t.is_active,
        total=total,
        lines=lines,
        updated_at=t.updated_at,
    )


@router.get("", response_model=list[TemplateRead])
def list_templates(
    _actor: StaffOrAdmin,
    db: DbSession,
    active_only: Annotated[bool, Query()] = False,
) -> list[TemplateRead]:
    return [template_read(t) for t in template_service.list_templates(db, active_only)]


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateIn, actor: StaffOrAdmin, db: DbSession
) -> TemplateRead:
    return template_read(template_service.save_template(db, None, payload, actor=actor))


@router.get("/{template_id}", response_model=TemplateRead)
def get_template(
    template_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> TemplateRead:
    return template_read(template_service.get_template(db, template_id))


@router.put("/{template_id}", response_model=TemplateRead)
def update_template(
    template_id: uuid.UUID, payload: TemplateIn, actor: StaffOrAdmin, db: DbSession
) -> TemplateRead:
    """Replaces the template. Quotations already made from it don't change."""
    return template_read(
        template_service.save_template(db, template_id, payload, actor=actor)
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: uuid.UUID, _actor: StaffOrAdmin, db: DbSession
) -> Response:
    template_service.delete_template(db, template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
