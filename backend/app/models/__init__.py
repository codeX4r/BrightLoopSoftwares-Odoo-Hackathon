"""Import every ORM model here so Alembic autogenerate can see them via Base.metadata."""

from app.db.base import Base
from app.models.auth_session import AuthSession
from app.models.customer_profile import CustomerProfile
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.number_sequence import NumberSequence
from app.models.payment import Payment, PaymentMethod
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
    "CustomerProfile",
    "Invoice",
    "InvoiceLine",
    "InvoiceStatus",
    "NumberSequence",
    "Payment",
    "PaymentMethod",
    "Subscription",
    "SubscriptionLine",
    "SubscriptionStatus",
    "User",
    "UserRole",
]
