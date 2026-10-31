"""Quotation templates. Lines are resolved from the catalog the same way quotation lines
are (subscription_service.build_lines), then copied onto the template."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import SubscriptionPlan
from app.models.quotation_template import QuotationTemplate, QuotationTemplateLine
from app.models.user import User
from app.services import subscription_service
from app.services.errors import ConflictError, InvalidInputError, NotFoundError


def list_templates(db: Session, active_only: bool) -> Sequence[QuotationTemplate]:
    query = select(QuotationTemplate).options(selectinload(QuotationTemplate.lines))
    if active_only:
        query = query.where(QuotationTemplate.is_active.is_(True))
    return db.scalars(query.order_by(QuotationTemplate.name)).all()


def get_template(db: Session, template_id: uuid.UUID) -> QuotationTemplate:
    template = db.scalar(
        select(QuotationTemplate)
        .options(selectinload(QuotationTemplate.lines))
        .where(QuotationTemplate.id == template_id)
    )
    if template is None:
        raise NotFoundError("Quotation template not found")
    return template


def save_template(db: Session, template_id: uuid.UUID | None, data, *, actor: User):
    """Creates (template_id None) or fully replaces a template."""
    name = data.name.strip()
    clash = select(QuotationTemplate.id).where(
        func.lower(QuotationTemplate.name) == name.lower()
    )
    if template_id is not None:
        clash = clash.where(QuotationTemplate.id != template_id)
    if db.scalar(clash) is not None:
        raise ConflictError("A template with this name already exists")

    plan: SubscriptionPlan | None = None
    if data.plan_id is not None:
        plan = db.get(SubscriptionPlan, data.plan_id)
        if plan is None:
            raise InvalidInputError("Subscription plan not found")
    plan_name = plan.name if plan else data.plan_name
    frequency = plan.billing_frequency if plan else data.billing_frequency
    if not plan_name or frequency is None:
        raise InvalidInputError(
            "Choose a subscription plan, or enter a plan name and billing frequency"
        )
    lines = subscription_service.build_lines(db, data.lines, plan)

    template = (
        QuotationTemplate(created_by_id=actor.id)
        if template_id is None
        else get_template(db, template_id)
    )
    template.name = name
    template.description = data.description or None
    template.plan_id = plan.id if plan else None
    template.plan_name = plan_name
    template.billing_frequency = frequency
    template.validity_days = data.validity_days
    template.payment_terms_days = data.payment_terms_days
    template.notes = data.notes or None
    template.is_active = data.is_active
    template.lines = [
        QuotationTemplateLine(
            position=line.position,
            is_plan_line=line.is_plan_line,
            product_id=line.product_id,
            variant_id=line.variant_id,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
        )
        for line in lines
    ]
    if template_id is None:
        db.add(template)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A template with this name already exists") from exc
    return get_template(db, template.id)


def delete_template(db: Session, template_id: uuid.UUID) -> None:
    db.delete(get_template(db, template_id))
    db.commit()
