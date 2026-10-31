"""Import every ORM model here so Alembic autogenerate can see them via Base.metadata."""

from app.db.base import Base
from app.models.auth_session import AuthSession
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
from app.models.user import User, UserRole

__all__ = [
    "AuthSession",
    "Base",
    "BillingFrequency",
    "PlanStatus",
    "Product",
    "ProductStatus",
    "ProductType",
    "ProductVariant",
    "SubscriptionPlan",
    "User",
    "UserRole",
    "plan_products",
]
