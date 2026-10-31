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
from app.models.discount import (
    Discount,
    DiscountRedemption,
    DiscountScope,
    DiscountType,
    discount_products,
)
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.number_sequence import NumberSequence
from app.models.password_reset import PasswordResetToken
from app.models.payment import Payment, PaymentMethod
from app.models.profiles import CustomerProfile, StaffProfile
from app.models.settings import AppSettings

# BillingFrequency is defined once, in subscription.py, and shared with the catalog, so
# both tables use the same Postgres enum type "billing_frequency".
from app.models.subscription import (
    BillingFrequency,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
)
from app.models.tax import Tax, tax_product_types, tax_products
from app.models.user import User, UserRole

__all__ = [
    "AppSettings",
    "AuthSession",
    "Base",
    "BillingFrequency",
    "CustomerProfile",
    "Discount",
    "DiscountRedemption",
    "DiscountScope",
    "DiscountType",
    "Invoice",
    "InvoiceLine",
    "InvoiceStatus",
    "NumberSequence",
    "PasswordResetToken",
    "Payment",
    "PaymentMethod",
    "PlanStatus",
    "Product",
    "ProductStatus",
    "ProductType",
    "ProductVariant",
    "StaffProfile",
    "Subscription",
    "SubscriptionLine",
    "SubscriptionPlan",
    "SubscriptionStatus",
    "Tax",
    "User",
    "UserRole",
    "discount_products",
    "plan_products",
    "tax_product_types",
    "tax_products",
]
