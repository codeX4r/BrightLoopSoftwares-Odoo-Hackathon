"""Tax rules configured by the admin.

Taxes are never deleted, only deactivated, because existing lines and invoices keep a copy
of the rate they were created with.

Which tax applies to a product (resolve_tax):
1. an active tax assigned to that product,
2. otherwise an active tax assigned to the product's type,
3. otherwise the active default tax,
4. otherwise none (rate 0 is NOT assumed; the caller decides).
If several active taxes match at the same level, the one with the lowest name wins, so the
result is stable.
"""

import uuid
from collections.abc import Iterable, Sequence

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.catalog import Product, ProductType
from app.models.tax import Tax, tax_product_types, tax_products
from app.services.errors import ConflictError, InvalidInputError, NotFoundError
from app.services.money import round_money


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "A tax with this name already exists, or two defaults clashed."
        ) from exc


def get_tax(db: Session, tax_id: uuid.UUID) -> Tax:
    tax = db.get(Tax, tax_id)
    if tax is None:
        raise NotFoundError("Tax not found.")
    return tax


def _check_name_free(db: Session, name: str, *, exclude_id: uuid.UUID | None) -> None:
    query = select(Tax.id).where(func.lower(Tax.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Tax.id != exclude_id)
    if db.scalar(query) is not None:
        raise ConflictError("A tax with this name already exists.")


def _products(db: Session, ids: Iterable[uuid.UUID]) -> list[Product]:
    ids = list(dict.fromkeys(ids))
    if not ids:
        return []
    found = list(db.scalars(select(Product).where(Product.id.in_(ids))))
    if len(found) != len(ids):
        raise InvalidInputError("One or more selected products do not exist.")
    return found


def _product_types(db: Session, ids: Iterable[uuid.UUID]) -> list[ProductType]:
    ids = list(dict.fromkeys(ids))
    if not ids:
        return []
    found = list(db.scalars(select(ProductType).where(ProductType.id.in_(ids))))
    if len(found) != len(ids):
        raise InvalidInputError("One or more selected product types do not exist.")
    return found


def _clear_other_defaults(db: Session, keep_id: uuid.UUID | None) -> None:
    query = update(Tax).where(Tax.is_default.is_(True)).values(is_default=False)
    if keep_id is not None:
        query = query.where(Tax.id != keep_id)
    db.execute(query)
    db.flush()


def list_taxes(
    db: Session, *, q: str | None, is_active: bool | None, limit: int, offset: int
) -> tuple[Sequence[Tax], int]:
    query = select(Tax)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(Tax.name.ilike(pattern) | Tax.tax_type.ilike(pattern))
    if is_active is not None:
        query = query.where(Tax.is_active.is_(is_active))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Tax.is_default.desc(), Tax.name).limit(limit).offset(offset)
    ).all()
    return items, total


def create_tax(
    db: Session,
    *,
    name: str,
    rate,
    tax_type: str,
    description: str | None,
    is_active: bool,
    is_default: bool,
    product_ids: list[uuid.UUID],
    product_type_ids: list[uuid.UUID],
) -> Tax:
    name = name.strip()
    _check_name_free(db, name, exclude_id=None)
    if is_default and not is_active:
        raise InvalidInputError("The default tax must be active.")
    tax = Tax(
        name=name,
        rate=round_money(rate),
        tax_type=tax_type.strip(),
        description=(description or "").strip() or None,
        is_active=is_active,
        is_default=False,
        products=_products(db, product_ids),
        product_types=_product_types(db, product_type_ids),
    )
    db.add(tax)
    db.flush()
    if is_default:
        _clear_other_defaults(db, keep_id=tax.id)
        tax.is_default = True
    _commit(db)
    db.refresh(tax)
    return tax


def update_tax(db: Session, tax: Tax, changes: dict) -> Tax:
    if changes.get("name") is not None:
        changes["name"] = changes["name"].strip()
        _check_name_free(db, changes["name"], exclude_id=tax.id)
    new_active = changes.get("is_active", tax.is_active)
    new_default = changes.get("is_default", tax.is_default)
    if new_active is None:
        new_active = tax.is_active
    if new_default is None:
        new_default = tax.is_default
    if new_default and not new_active:
        raise InvalidInputError(
            "The default tax must be active. Choose another default before deactivating it."
        )

    if "product_ids" in changes and changes["product_ids"] is not None:
        tax.products = _products(db, changes.pop("product_ids"))
    else:
        changes.pop("product_ids", None)
    if "product_type_ids" in changes and changes["product_type_ids"] is not None:
        tax.product_types = _product_types(db, changes.pop("product_type_ids"))
    else:
        changes.pop("product_type_ids", None)

    if changes.get("rate") is not None:
        changes["rate"] = round_money(changes["rate"])
    if "description" in changes:
        changes["description"] = (changes["description"] or "").strip() or None
    if changes.get("tax_type") is not None:
        changes["tax_type"] = changes["tax_type"].strip()

    becoming_default = changes.pop("is_default", None)
    for field_name, value in changes.items():
        if value is not None or field_name == "description":
            setattr(tax, field_name, value)
    if becoming_default is True:
        _clear_other_defaults(db, keep_id=tax.id)
        tax.is_default = True
    elif becoming_default is False:
        tax.is_default = False
    _commit(db)
    db.refresh(tax)
    return tax


def active_taxes(db: Session) -> Sequence[Tax]:
    return db.scalars(
        select(Tax)
        .where(Tax.is_active.is_(True))
        .order_by(Tax.is_default.desc(), Tax.name)
    ).all()


def default_tax(db: Session) -> Tax | None:
    return db.scalar(
        select(Tax).where(Tax.is_default.is_(True), Tax.is_active.is_(True))
    )


def resolve_tax(db: Session, product_id: uuid.UUID | None) -> Tax | None:
    """The tax that applies to a product, by product > product type > default."""
    if product_id is not None:
        product = db.get(Product, product_id)
        if product is None:
            raise NotFoundError("Product not found.")
        by_product = db.scalar(
            select(Tax)
            .join(tax_products, tax_products.c.tax_id == Tax.id)
            .where(tax_products.c.product_id == product.id, Tax.is_active.is_(True))
            .order_by(Tax.name)
            .limit(1)
        )
        if by_product is not None:
            return by_product
        by_type = db.scalar(
            select(Tax)
            .join(tax_product_types, tax_product_types.c.tax_id == Tax.id)
            .where(
                tax_product_types.c.product_type_id == product.product_type_id,
                Tax.is_active.is_(True),
            )
            .order_by(Tax.name)
            .limit(1)
        )
        if by_type is not None:
            return by_type
    return default_tax(db)
