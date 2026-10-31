"""Read-only catalog for the staff quotation form: plans and products staff can offer.

The admin manages the catalog under /api/admin; staff only need what is offerable today,
with final prices and the tax that applies already worked out.
"""

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.permissions import StaffOrAdmin
from app.db.session import DbSession
from app.models.catalog import BillingFrequency, ProductStatus
from app.services import catalog_service, clock, tax_service

router = APIRouter(prefix="/catalog", tags=["staff: catalog"])


class TaxRef(BaseModel):
    id: uuid.UUID
    name: str
    rate: Decimal


class VariantOption(BaseModel):
    id: uuid.UUID
    name: str
    additional_price: Decimal
    # Product sales price plus the variant's additional price.
    final_price: Decimal


class ProductOption(BaseModel):
    id: uuid.UUID
    name: str
    product_type: str
    sales_price: Decimal
    description: str | None
    # The tax that applies (product, then product type, then the default), or None.
    tax: TaxRef | None
    variants: list[VariantOption]


class PlanOption(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    billing_frequency: BillingFrequency
    minimum_quantity: int
    allow_pause: bool
    allow_renewal: bool
    allow_early_closure: bool
    auto_close_on_expiry: bool
    product_ids: list[uuid.UUID]
    # The default tax, used for the plan line unless staff change it.
    tax: TaxRef | None


def _tax_ref(tax) -> TaxRef | None:
    return TaxRef(id=tax.id, name=tax.name, rate=tax.rate) if tax is not None else None


@router.get("/plans", response_model=list[PlanOption])
def offerable_plans(_actor: StaffOrAdmin, db: DbSession) -> list[PlanOption]:
    """Plans that can be offered today (active and inside their availability window)."""
    plans, _total = catalog_service.list_plans(
        db,
        q=None,
        status=None,
        billing_frequency=None,
        offerable_on=clock.today(),
        limit=200,
        offset=0,
    )
    default = _tax_ref(tax_service.default_tax(db))
    return [
        PlanOption(
            id=p.id,
            name=p.name,
            description=p.description,
            price=p.price,
            billing_frequency=p.billing_frequency,
            minimum_quantity=p.minimum_quantity,
            allow_pause=p.allow_pause,
            allow_renewal=p.allow_renewal,
            allow_early_closure=p.allow_early_closure,
            auto_close_on_expiry=p.auto_close_on_expiry,
            product_ids=[prod.id for prod in p.products],
            tax=default,
        )
        for p in plans
    ]


@router.get("/products", response_model=list[ProductOption])
def active_products(
    _actor: StaffOrAdmin,
    db: DbSession,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> list[ProductOption]:
    """Active products with active variants, final prices and the tax that applies."""
    products, _total = catalog_service.list_products(
        db,
        q=search,
        status=ProductStatus.ACTIVE,
        product_type_id=None,
        limit=200,
        offset=0,
    )
    return [
        ProductOption(
            id=p.id,
            name=p.name,
            product_type=p.product_type.name,
            sales_price=p.sales_price,
            description=p.description,
            tax=_tax_ref(tax_service.resolve_tax(db, p.id)),
            variants=[
                VariantOption(
                    id=v.id,
                    name=v.name,
                    additional_price=v.additional_price,
                    final_price=p.sales_price + v.additional_price,
                )
                for v in p.variants
                if v.status == ProductStatus.ACTIVE
            ],
        )
        for p in products
    ]
