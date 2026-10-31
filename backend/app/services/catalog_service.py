"""Business rules for product types, products, variants and subscription plans.

Routes call these functions; they never write catalog rows directly.
"""

import uuid
from collections.abc import Iterable, Sequence
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.catalog import (
    BillingFrequency,
    PlanStatus,
    Product,
    ProductStatus,
    ProductType,
    ProductVariant,
    SubscriptionPlan,
    plan_products,
)
from app.services.errors import ConflictError, InvalidInputError, NotFoundError

CENT = Decimal("0.01")


def _commit(db: Session, conflict_message: str) -> None:
    """Commits, turning a unique-constraint race into a conflict error."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(conflict_message) from exc


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


# --- Product types -----------------------------------------------------------


def list_product_types(db: Session) -> Sequence[ProductType]:
    return db.scalars(select(ProductType).order_by(ProductType.name)).all()


def create_product_type(db: Session, name: str) -> ProductType:
    name = name.strip()
    exists = db.scalar(
        select(ProductType.id).where(func.lower(ProductType.name) == name.lower())
    )
    if exists is not None:
        raise ConflictError("A product type with this name already exists.")
    product_type = ProductType(name=name)
    db.add(product_type)
    _commit(db, "A product type with this name already exists.")
    db.refresh(product_type)
    return product_type


# --- Products ----------------------------------------------------------------


def get_product(db: Session, product_id: uuid.UUID) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError("Product not found.")
    return product


def _check_product_name_free(
    db: Session, name: str, *, exclude_id: uuid.UUID | None
) -> None:
    query = select(Product.id).where(func.lower(Product.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Product.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("A product with this name already exists.")


def _require_product_type(db: Session, product_type_id: uuid.UUID) -> None:
    if db.get(ProductType, product_type_id) is None:
        raise InvalidInputError("The selected product type does not exist.")


def list_products(
    db: Session,
    *,
    q: str | None,
    status: ProductStatus | None,
    product_type_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[Product], int]:
    query = select(Product)
    if q:
        query = query.where(Product.name.ilike(f"%{q.strip()}%"))
    if status is not None:
        query = query.where(Product.status == status)
    if product_type_id is not None:
        query = query.where(Product.product_type_id == product_type_id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(Product.name).limit(limit).offset(offset)).all()
    return items, total


def create_product(
    db: Session,
    *,
    name: str,
    product_type_id: uuid.UUID,
    sales_price: Decimal,
    cost_price: Decimal,
    description: str | None,
    status: ProductStatus,
) -> Product:
    name = name.strip()
    _check_product_name_free(db, name, exclude_id=None)
    _require_product_type(db, product_type_id)
    product = Product(
        name=name,
        product_type_id=product_type_id,
        sales_price=_money(sales_price),
        cost_price=_money(cost_price),
        description=description,
        status=status,
    )
    db.add(product)
    _commit(db, "A product with this name already exists.")
    db.refresh(product)
    return product


def update_product(db: Session, product: Product, changes: dict) -> Product:
    if "name" in changes and changes["name"] is not None:
        changes["name"] = changes["name"].strip()
        _check_product_name_free(db, changes["name"], exclude_id=product.id)
    if changes.get("product_type_id") is not None:
        _require_product_type(db, changes["product_type_id"])
    for money_field in ("sales_price", "cost_price"):
        if changes.get(money_field) is not None:
            changes[money_field] = _money(changes[money_field])
    for field, value in changes.items():
        if value is not None or field == "description":
            setattr(product, field, value)
    _commit(db, "A product with this name already exists.")
    db.refresh(product)
    return product


def delete_product(db: Session, product: Product) -> None:
    """Deletes a product only when nothing refers to it. Otherwise it should be archived."""
    if _product_in_use(db, product.id):
        raise ConflictError(
            "This product is used by a subscription plan. Archive it instead of deleting it."
        )
    db.delete(product)
    db.commit()


def _product_in_use(db: Session, product_id: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(plan_products.c.product_id).where(
                plan_products.c.product_id == product_id
            )
        )
        is not None
    )


# --- Variants ----------------------------------------------------------------


def get_variant(db: Session, variant_id: uuid.UUID) -> ProductVariant:
    variant = db.get(ProductVariant, variant_id)
    if variant is None:
        raise NotFoundError("Variant not found.")
    return variant


def variant_final_price(product: Product, variant: ProductVariant) -> Decimal:
    """The price a customer pays for this variant: base sales price plus the variant's extra."""
    return _money(product.sales_price + variant.additional_price)


def _check_variant_name_free(
    db: Session, product_id: uuid.UUID, name: str, *, exclude_id: uuid.UUID | None
) -> None:
    query = select(ProductVariant.id).where(
        ProductVariant.product_id == product_id,
        func.lower(ProductVariant.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.where(ProductVariant.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("This product already has a variant with this name.")


def list_variants(db: Session, product_id: uuid.UUID) -> Sequence[ProductVariant]:
    return db.scalars(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id)
        .order_by(ProductVariant.name)
    ).all()


def create_variant(
    db: Session,
    product: Product,
    *,
    name: str,
    additional_price: Decimal,
    description: str | None,
    status: ProductStatus,
) -> ProductVariant:
    name = name.strip()
    _check_variant_name_free(db, product.id, name, exclude_id=None)
    variant = ProductVariant(
        product_id=product.id,
        name=name,
        additional_price=_money(additional_price),
        description=description,
        status=status,
    )
    db.add(variant)
    _commit(db, "This product already has a variant with this name.")
    db.refresh(variant)
    return variant


def update_variant(
    db: Session, variant: ProductVariant, changes: dict
) -> ProductVariant:
    if changes.get("name") is not None:
        changes["name"] = changes["name"].strip()
        _check_variant_name_free(
            db, variant.product_id, changes["name"], exclude_id=variant.id
        )
    if changes.get("additional_price") is not None:
        changes["additional_price"] = _money(changes["additional_price"])
    for field, value in changes.items():
        if value is not None or field == "description":
            setattr(variant, field, value)
    _commit(db, "This product already has a variant with this name.")
    db.refresh(variant)
    return variant


def delete_variant(db: Session, variant: ProductVariant) -> None:
    """Deletes a variant. Variants are referenced by subscription lines once those exist
    (phase 5); until then nothing can refer to one, so deletion is always safe."""
    db.delete(variant)
    db.commit()


# --- Subscription plans ------------------------------------------------------


def get_plan(db: Session, plan_id: uuid.UUID) -> SubscriptionPlan:
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise NotFoundError("Subscription plan not found.")
    return plan


def is_plan_offerable(plan: SubscriptionPlan, today: date) -> bool:
    """A plan can be sold to new customers only when it is active and today is in its window."""
    if plan.status != PlanStatus.ACTIVE:
        return False
    if today < plan.available_from:
        return False
    return plan.available_until is None or today <= plan.available_until


def validate_plan_window(available_from: date, available_until: date | None) -> None:
    if available_until is not None and available_until < available_from:
        raise InvalidInputError(
            "The availability end date must be on or after the start date."
        )


def _resolve_products(db: Session, product_ids: Iterable[uuid.UUID]) -> list[Product]:
    ids = list(dict.fromkeys(product_ids))
    if not ids:
        raise InvalidInputError("A plan needs at least one product.")
    products = list(db.scalars(select(Product).where(Product.id.in_(ids))).all())
    if len(products) != len(ids):
        raise InvalidInputError("One or more selected products do not exist.")
    if any(p.status != ProductStatus.ACTIVE for p in products):
        raise InvalidInputError("Archived products cannot be added to a plan.")
    return products


def _check_plan_name_free(
    db: Session, name: str, *, exclude_id: uuid.UUID | None
) -> None:
    query = select(SubscriptionPlan.id).where(
        func.lower(SubscriptionPlan.name) == name.lower()
    )
    if exclude_id is not None:
        query = query.where(SubscriptionPlan.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("A subscription plan with this name already exists.")


def list_plans(
    db: Session,
    *,
    q: str | None,
    status: PlanStatus | None,
    billing_frequency: BillingFrequency | None,
    offerable_on: date | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[SubscriptionPlan], int]:
    query = select(SubscriptionPlan)
    if q:
        query = query.where(SubscriptionPlan.name.ilike(f"%{q.strip()}%"))
    if status is not None:
        query = query.where(SubscriptionPlan.status == status)
    if billing_frequency is not None:
        query = query.where(SubscriptionPlan.billing_frequency == billing_frequency)
    if offerable_on is not None:
        query = query.where(
            SubscriptionPlan.status == PlanStatus.ACTIVE,
            SubscriptionPlan.available_from <= offerable_on,
            (SubscriptionPlan.available_until.is_(None))
            | (SubscriptionPlan.available_until >= offerable_on),
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(SubscriptionPlan.name).limit(limit).offset(offset)
    ).all()
    return items, total


def create_plan(
    db: Session,
    *,
    name: str,
    description: str | None,
    product_ids: list[uuid.UUID],
    price: Decimal,
    billing_frequency: BillingFrequency,
    minimum_quantity: int,
    available_from: date,
    available_until: date | None,
    auto_close_on_expiry: bool,
    allow_early_closure: bool,
    allow_pause: bool,
    allow_renewal: bool,
    status: PlanStatus,
) -> SubscriptionPlan:
    name = name.strip()
    validate_plan_window(available_from, available_until)
    _check_plan_name_free(db, name, exclude_id=None)
    products = _resolve_products(db, product_ids)
    plan = SubscriptionPlan(
        name=name,
        description=description,
        products=products,
        price=_money(price),
        billing_frequency=billing_frequency,
        minimum_quantity=minimum_quantity,
        available_from=available_from,
        available_until=available_until,
        auto_close_on_expiry=auto_close_on_expiry,
        allow_early_closure=allow_early_closure,
        allow_pause=allow_pause,
        allow_renewal=allow_renewal,
        status=status,
    )
    db.add(plan)
    _commit(db, "A subscription plan with this name already exists.")
    db.refresh(plan)
    return plan


def update_plan(db: Session, plan: SubscriptionPlan, changes: dict) -> SubscriptionPlan:
    if changes.get("name") is not None:
        changes["name"] = changes["name"].strip()
        _check_plan_name_free(db, changes["name"], exclude_id=plan.id)

    new_from = changes.get("available_from") or plan.available_from
    new_until = changes.get("available_until", plan.available_until)
    validate_plan_window(new_from, new_until)

    if changes.get("price") is not None:
        changes["price"] = _money(changes["price"])
    if changes.get("product_ids") is not None:
        plan.products = _resolve_products(db, changes.pop("product_ids"))
    else:
        changes.pop("product_ids", None)

    for field, value in changes.items():
        if field == "available_until":
            plan.available_until = value
        elif value is not None or field == "description":
            setattr(plan, field, value)
    _commit(db, "A subscription plan with this name already exists.")
    db.refresh(plan)
    return plan
