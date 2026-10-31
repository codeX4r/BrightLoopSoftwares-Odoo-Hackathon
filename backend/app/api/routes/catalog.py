"""Admin catalog APIs: product types, products, variants and subscription plans.

Every route requires an authenticated ADMIN. The role is checked on the server, so the
frontend's navigation can't grant access on its own.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import require_roles
from app.db.session import DbSession
from app.models.catalog import (
    BillingFrequency,
    PlanStatus,
    Product,
    ProductStatus,
    ProductVariant,
    SubscriptionPlan,
)
from app.models.user import UserRole
from app.schemas.catalog import (
    Page,
    PlanCreate,
    PlanRead,
    PlanUpdate,
    ProductCreate,
    ProductRead,
    ProductTypeCreate,
    ProductTypeRead,
    ProductUpdate,
    VariantCreate,
    VariantRead,
    VariantUpdate,
)
from app.services import catalog_service

router = APIRouter(
    prefix="/api/admin",
    tags=["admin: catalog"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)

Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Search = Annotated[str | None, Query(max_length=100)]


def _variant_read(product: Product, variant: ProductVariant) -> VariantRead:
    return VariantRead(
        id=variant.id,
        product_id=variant.product_id,
        name=variant.name,
        additional_price=variant.additional_price,
        final_price=catalog_service.variant_final_price(product, variant),
        description=variant.description,
        status=variant.status,
    )


def _plan_read(plan: SubscriptionPlan, today: date) -> PlanRead:
    return PlanRead(
        id=plan.id,
        name=plan.name,
        description=plan.description,
        price=plan.price,
        billing_frequency=plan.billing_frequency,
        minimum_quantity=plan.minimum_quantity,
        available_from=plan.available_from,
        available_until=plan.available_until,
        auto_close_on_expiry=plan.auto_close_on_expiry,
        allow_early_closure=plan.allow_early_closure,
        allow_pause=plan.allow_pause,
        allow_renewal=plan.allow_renewal,
        status=plan.status,
        product_ids=[product.id for product in plan.products],
        is_offerable=catalog_service.is_plan_offerable(plan, today),
    )


# --- Product types -----------------------------------------------------------


@router.get("/product-types", response_model=list[ProductTypeRead])
def list_product_types(db: DbSession) -> list[ProductTypeRead]:
    return [
        ProductTypeRead.model_validate(t)
        for t in catalog_service.list_product_types(db)
    ]


@router.post(
    "/product-types",
    response_model=ProductTypeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_product_type(payload: ProductTypeCreate, db: DbSession) -> ProductTypeRead:
    product_type = catalog_service.create_product_type(db, payload.name)
    return ProductTypeRead.model_validate(product_type)


# --- Products ----------------------------------------------------------------


@router.get("/products", response_model=Page[ProductRead])
def list_products(
    db: DbSession,
    q: Search = None,
    status_filter: Annotated[ProductStatus | None, Query(alias="status")] = None,
    product_type_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[ProductRead]:
    items, total = catalog_service.list_products(
        db,
        q=q,
        status=status_filter,
        product_type_id=product_type_id,
        limit=limit,
        offset=offset,
    )
    return Page[ProductRead](
        items=[ProductRead.model_validate(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED
)
def create_product(payload: ProductCreate, db: DbSession) -> ProductRead:
    product = catalog_service.create_product(db, **payload.model_dump())
    return ProductRead.model_validate(product)


@router.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: uuid.UUID, db: DbSession) -> ProductRead:
    return ProductRead.model_validate(catalog_service.get_product(db, product_id))


@router.patch("/products/{product_id}", response_model=ProductRead)
def update_product(
    product_id: uuid.UUID, payload: ProductUpdate, db: DbSession
) -> ProductRead:
    product = catalog_service.get_product(db, product_id)
    updated = catalog_service.update_product(
        db, product, payload.model_dump(exclude_unset=True)
    )
    return ProductRead.model_validate(updated)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: uuid.UUID, db: DbSession) -> Response:
    catalog_service.delete_product(db, catalog_service.get_product(db, product_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Variants ----------------------------------------------------------------


@router.get("/products/{product_id}/variants", response_model=list[VariantRead])
def list_variants(product_id: uuid.UUID, db: DbSession) -> list[VariantRead]:
    product = catalog_service.get_product(db, product_id)
    return [
        _variant_read(product, v) for v in catalog_service.list_variants(db, product.id)
    ]


@router.post(
    "/products/{product_id}/variants",
    response_model=VariantRead,
    status_code=status.HTTP_201_CREATED,
)
def create_variant(
    product_id: uuid.UUID, payload: VariantCreate, db: DbSession
) -> VariantRead:
    product = catalog_service.get_product(db, product_id)
    variant = catalog_service.create_variant(db, product, **payload.model_dump())
    return _variant_read(product, variant)


@router.patch("/variants/{variant_id}", response_model=VariantRead)
def update_variant(
    variant_id: uuid.UUID, payload: VariantUpdate, db: DbSession
) -> VariantRead:
    variant = catalog_service.get_variant(db, variant_id)
    updated = catalog_service.update_variant(
        db, variant, payload.model_dump(exclude_unset=True)
    )
    return _variant_read(updated.product, updated)


@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variant(variant_id: uuid.UUID, db: DbSession) -> Response:
    catalog_service.delete_variant(db, catalog_service.get_variant(db, variant_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Subscription plans ------------------------------------------------------


@router.get("/plans", response_model=Page[PlanRead])
def list_plans(
    db: DbSession,
    q: Search = None,
    status_filter: Annotated[PlanStatus | None, Query(alias="status")] = None,
    billing_frequency: BillingFrequency | None = None,
    offerable: bool = False,
    limit: Limit = 20,
    offset: Offset = 0,
) -> Page[PlanRead]:
    """`offerable=true` returns only plans new customers can subscribe to today."""
    today = date.today()
    items, total = catalog_service.list_plans(
        db,
        q=q,
        status=status_filter,
        billing_frequency=billing_frequency,
        offerable_on=today if offerable else None,
        limit=limit,
        offset=offset,
    )
    return Page[PlanRead](
        items=[_plan_read(plan, today) for plan in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/plans", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanCreate, db: DbSession) -> PlanRead:
    plan = catalog_service.create_plan(db, **payload.model_dump())
    return _plan_read(plan, date.today())


@router.get("/plans/{plan_id}", response_model=PlanRead)
def get_plan(plan_id: uuid.UUID, db: DbSession) -> PlanRead:
    return _plan_read(catalog_service.get_plan(db, plan_id), date.today())


@router.patch("/plans/{plan_id}", response_model=PlanRead)
def update_plan(plan_id: uuid.UUID, payload: PlanUpdate, db: DbSession) -> PlanRead:
    plan = catalog_service.get_plan(db, plan_id)
    updated = catalog_service.update_plan(
        db, plan, payload.model_dump(exclude_unset=True)
    )
    return _plan_read(updated, date.today())
