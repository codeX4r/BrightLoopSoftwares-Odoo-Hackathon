"""Discount rules: configuration, eligibility and usage counting.

Agreed behaviour (docs/api-contracts.md, "Discounts"):
- A discount reduces the pre-tax subtotal; tax is calculated on the reduced amount.
- One discount per invoice (no stacking). When several are eligible, the one giving the
  largest reduction wins; ties go to the name that sorts first, so results are stable.
- A use is counted when an invoice is confirmed (redeem), never when a draft is created.
- Usage limits hold under concurrency: redeem increments the counter with a single
  conditional UPDATE, and the database also checks usage_count <= usage_limit.

Billing integration (applying the result to invoices) belongs to the staff billing code and
is described in the contract; this module provides evaluate() and redeem() for it.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.catalog import Product
from app.models.discount import (
    Discount,
    DiscountRedemption,
    DiscountScope,
    DiscountType,
)
from app.services.errors import ConflictError, InvalidInputError, NotFoundError
from app.services.money import ZERO, round_money

HUNDRED = Decimal(100)


# --- Configuration -----------------------------------------------------------


def get_discount(db: Session, discount_id: uuid.UUID) -> Discount:
    discount = db.get(Discount, discount_id)
    if discount is None:
        raise NotFoundError("Discount not found.")
    return discount


def _check_name_free(db: Session, name: str, *, exclude_id: uuid.UUID | None) -> None:
    query = select(Discount.id).where(func.lower(Discount.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Discount.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("A discount with this name already exists.")


def _products(db: Session, ids: Iterable[uuid.UUID]) -> list[Product]:
    ids = list(dict.fromkeys(ids))
    if not ids:
        return []
    found = list(db.scalars(select(Product).where(Product.id.in_(ids))))
    if len(found) != len(ids):
        raise InvalidInputError("One or more selected products do not exist.")
    return found


def validate_rule(
    *,
    discount_type: DiscountType,
    value: Decimal,
    start_date: date,
    end_date: date | None,
    scope: DiscountScope,
    product_count: int,
    usage_limit: int | None,
    usage_count: int,
) -> None:
    if value <= 0:
        raise InvalidInputError("The discount value must be greater than zero.")
    if discount_type == DiscountType.PERCENTAGE and value > HUNDRED:
        raise InvalidInputError("A percentage discount can't be more than 100%.")
    if end_date is not None and end_date < start_date:
        raise InvalidInputError("The end date must be on or after the start date.")
    if scope == DiscountScope.SPECIFIC_PRODUCTS and product_count == 0:
        raise InvalidInputError(
            "Choose at least one product for a product-specific discount."
        )
    if usage_limit is not None and usage_limit < usage_count:
        raise InvalidInputError(
            f"The usage limit can't be lower than the {usage_count} use(s) already counted."
        )


def list_discounts(
    db: Session,
    *,
    q: str | None,
    is_active: bool | None,
    discount_type: DiscountType | None,
    valid_on: date | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[Discount], int]:
    query = select(Discount)
    if q:
        query = query.where(Discount.name.ilike(f"%{q.strip()}%"))
    if is_active is not None:
        query = query.where(Discount.is_active.is_(is_active))
    if discount_type is not None:
        query = query.where(Discount.discount_type == discount_type)
    if valid_on is not None:
        query = query.where(*_valid_conditions(valid_on))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(Discount.name).limit(limit).offset(offset)).all()
    return items, total


def create_discount(db: Session, *, product_ids: list[uuid.UUID], **fields) -> Discount:
    fields["name"] = fields["name"].strip()
    _check_name_free(db, fields["name"], exclude_id=None)
    products = _products(db, product_ids)
    validate_rule(
        discount_type=fields["discount_type"],
        value=fields["value"],
        start_date=fields["start_date"],
        end_date=fields.get("end_date"),
        scope=fields["scope"],
        product_count=len(products),
        usage_limit=fields.get("usage_limit"),
        usage_count=0,
    )
    for money in ("value", "min_purchase_amount"):
        if fields.get(money) is not None:
            fields[money] = round_money(fields[money])
    if fields.get("description") is not None:
        fields["description"] = fields["description"].strip() or None
    discount = Discount(
        **fields,
        products=products if fields["scope"] == DiscountScope.SPECIFIC_PRODUCTS else [],
    )
    db.add(discount)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("A discount with this name already exists.") from exc
    db.refresh(discount)
    return discount


def update_discount(db: Session, discount: Discount, changes: dict) -> Discount:
    if changes.get("name") is not None:
        changes["name"] = changes["name"].strip()
        _check_name_free(db, changes["name"], exclude_id=discount.id)
    products = discount.products
    if changes.get("product_ids") is not None:
        products = _products(db, changes.pop("product_ids"))
    else:
        changes.pop("product_ids", None)

    def pick(name):
        return (
            changes[name]
            if name in changes and changes[name] is not None
            else getattr(discount, name)
        )

    scope = pick("scope")
    validate_rule(
        discount_type=pick("discount_type"),
        value=pick("value"),
        start_date=pick("start_date"),
        end_date=changes.get("end_date", discount.end_date),
        scope=scope,
        product_count=len(products),
        usage_limit=changes.get("usage_limit", discount.usage_limit),
        usage_count=discount.usage_count,
    )
    discount.products = products if scope == DiscountScope.SPECIFIC_PRODUCTS else []

    nullable = {
        "description",
        "end_date",
        "usage_limit",
        "min_purchase_amount",
        "min_quantity",
    }
    for field_name, value in changes.items():
        if field_name in ("value", "min_purchase_amount") and value is not None:
            value = round_money(value)
        if field_name == "description" and isinstance(value, str):
            value = value.strip() or None
        if value is not None or field_name in nullable:
            setattr(discount, field_name, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "This change conflicts with the discount's existing data."
        ) from exc
    db.refresh(discount)
    return discount


# --- Eligibility -------------------------------------------------------------


@dataclass(frozen=True)
class LineInput:
    """A priced line before tax. product_id is None for free-text lines."""

    product_id: uuid.UUID | None
    quantity: int
    subtotal: Decimal


@dataclass(frozen=True)
class DiscountResult:
    discount: Discount
    # Subtotal the discount was calculated on (all lines, or only the matching products).
    applicable_subtotal: Decimal
    amount: Decimal


def _valid_conditions(as_of: date):
    return (
        Discount.is_active.is_(True),
        Discount.start_date <= as_of,
        or_(Discount.end_date.is_(None), Discount.end_date >= as_of),
        or_(
            Discount.usage_limit.is_(None), Discount.usage_count < Discount.usage_limit
        ),
    )


def is_valid_on(discount: Discount, as_of: date) -> bool:
    return (
        discount.is_active
        and discount.start_date <= as_of
        and (discount.end_date is None or discount.end_date >= as_of)
        and (
            discount.usage_limit is None or discount.usage_count < discount.usage_limit
        )
    )


def amount_for(discount: Discount, lines: Sequence[LineInput]) -> DiscountResult | None:
    """The reduction this discount gives on these lines, or None if they don't qualify."""
    if discount.scope == DiscountScope.SPECIFIC_PRODUCTS:
        product_ids = {p.id for p in discount.products}
        matching = [line for line in lines if line.product_id in product_ids]
    else:
        matching = list(lines)
    if not matching:
        return None
    subtotal = round_money(sum((line.subtotal for line in matching), ZERO))
    quantity = sum(line.quantity for line in matching)
    if (
        discount.min_purchase_amount is not None
        and subtotal < discount.min_purchase_amount
    ):
        return None
    if discount.min_quantity is not None and quantity < discount.min_quantity:
        return None
    if subtotal <= 0:
        return None
    if discount.discount_type == DiscountType.PERCENTAGE:
        amount = round_money(subtotal * discount.value / HUNDRED)
    else:
        amount = min(discount.value, subtotal)
    return DiscountResult(
        discount=discount, applicable_subtotal=subtotal, amount=amount
    )


def evaluate(
    db: Session, lines: Sequence[LineInput], as_of: date
) -> DiscountResult | None:
    """The best eligible discount for these lines on this date (no stacking)."""
    candidates = db.scalars(
        select(Discount).where(*_valid_conditions(as_of)).order_by(Discount.name)
    ).all()
    best: DiscountResult | None = None
    for discount in candidates:
        result = amount_for(discount, lines)
        if result is not None and (best is None or result.amount > best.amount):
            best = result
    return best


# --- Usage counting ----------------------------------------------------------


def redeem(
    db: Session,
    *,
    discount_id: uuid.UUID,
    invoice_id: uuid.UUID,
    amount: Decimal,
    as_of: date,
) -> DiscountRedemption:
    """Counts one use of a discount for an invoice, inside the caller's transaction.

    Call it while confirming the invoice and commit together with the confirmation. Raises
    ConflictError if the discount is no longer valid or its limit is reached, and if this
    invoice already used it. The caller must roll back on error.
    """
    counted = db.execute(
        update(Discount)
        .where(Discount.id == discount_id, *_valid_conditions(as_of))
        .values(usage_count=Discount.usage_count + 1)
        .execution_options(synchronize_session=False)
    )
    if counted.rowcount != 1:
        raise ConflictError(
            "This discount can no longer be used: it is inactive, expired or fully used."
        )
    redemption = DiscountRedemption(
        discount_id=discount_id, invoice_id=invoice_id, amount=round_money(amount)
    )
    db.add(redemption)
    try:
        db.flush()
    except IntegrityError as exc:
        raise ConflictError("This invoice has already used this discount.") from exc
    return redemption


def redemptions_for(db: Session, discount_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count(DiscountRedemption.id)).where(
                DiscountRedemption.discount_id == discount_id
            )
        )
        or 0
    )
