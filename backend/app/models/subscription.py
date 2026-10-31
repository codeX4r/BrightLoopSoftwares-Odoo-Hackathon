import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Postgres enum stored by value, matching the convention used for user_role."""
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class BillingFrequency(enum.StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class SubscriptionStatus(enum.StrEnum):
    """Lifecycle: DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED."""

    DRAFT = "DRAFT"
    QUOTATION = "QUOTATION"
    CONFIRMED = "CONFIRMED"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class Subscription(Base):
    """A customer's subscription. Quotations are subscriptions in DRAFT/QUOTATION status.

    plan_name and billing_frequency are stored on the row until the admin-owned
    subscription_plans table exists; a plan_id foreign key will be added then.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        UniqueConstraint("number", name="uq_subscriptions_number"),
        # The billing job scans ACTIVE subscriptions by next_billing_date.
        Index("ix_subscriptions_status_next_billing", "status", "next_billing_date"),
        CheckConstraint(
            "payment_terms_days >= 0",
            name="ck_subscriptions_payment_terms_non_negative",
        ),
        CheckConstraint(
            "expiry_date IS NULL OR start_date IS NULL OR expiry_date >= start_date",
            name="ck_subscriptions_expiry_after_start",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(String(20))
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        pg_enum(SubscriptionStatus, "subscription_status"),
        default=SubscriptionStatus.DRAFT,
    )
    plan_name: Mapped[str] = mapped_column(String(200))
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        pg_enum(BillingFrequency, "billing_frequency")
    )
    start_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    next_billing_date: Mapped[date | None] = mapped_column(Date)
    payment_terms_days: Mapped[int] = mapped_column(default=0)
    quotation_valid_until: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    quotation_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set when the customer declines the quotation. The row is then CLOSED, so the
    # five-stage lifecycle is unchanged; these say why it closed.
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    lines: Mapped[list["SubscriptionLine"]] = relationship(
        back_populates="subscription",
        cascade="all, delete-orphan",
        order_by="SubscriptionLine.position",
    )


class SubscriptionLine(Base):
    """A priced line. Price and tax rate are copied here, so later price changes by the
    admin never alter an existing offer or subscription."""

    __tablename__ = "subscription_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_subscription_lines_quantity_positive"),
        CheckConstraint(
            "unit_price >= 0", name="ck_subscription_lines_unit_price_non_negative"
        ),
        CheckConstraint(
            "tax_rate >= 0 AND tax_rate <= 100",
            name="ck_subscription_lines_tax_rate_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(default=0)
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Percentage, e.g. 18.00 for 18% GST.
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal(0))

    subscription: Mapped[Subscription] = relationship(back_populates="lines")
