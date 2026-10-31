"""Import every ORM model here so Alembic autogenerate can see them via Base.metadata."""

from app.db.base import Base
from app.models.auth_session import AuthSession
from app.models.catalog import (
    PlanStatus,
    Product,
    ProductStatus,
    ProductType,
    ProductVariant,
    SubscriptionPlan,
    plan_products,
)
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.number_sequence import NumberSequence
from app.models.payment import Payment, PaymentMethod

# BillingFrequency is defined once, in subscription.py, and shared with the catalog, so
# both tables use the same Postgres enum type "billing_frequency".
from app.models.subscription import (
    BillingFrequency,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
)
from app.models.user import User, UserRole

__all__ = [
    "AuthSession",
    "Base",
    "BillingFrequency",
    "Invoice",
    "InvoiceLine",
    "InvoiceStatus",
    "NumberSequence",
    "Payment",
    "PaymentMethod",
    "PlanStatus",
    "Product",
    "ProductStatus",
    "ProductType",
    "ProductVariant",
    "Subscription",
    "SubscriptionLine",
    "SubscriptionPlan",
    "SubscriptionStatus",
    "User",
    "UserRole",
    "plan_products",
]
