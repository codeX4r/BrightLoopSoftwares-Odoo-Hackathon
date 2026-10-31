import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.subscription import Subscription, pg_enum
from app.models.user import User


class InvoiceStatus(enum.StrEnum):
    """Lifecycle: DRAFT -> CONFIRMED -> PAID, or CANCELLED before any payment."""

    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("number", name="uq_invoices_number"),
        # One invoice per subscription per billing cycle, enforced by the database so a
        # repeated or concurrent billing run can never double-bill.
        UniqueConstraint(
            "subscription_id", "period_start", name="uq_invoices_subscription_period"
        ),
        Index("ix_invoices_status_due_date", "status", "due_date"),
        CheckConstraint(
            "amount_paid >= 0 AND amount_paid <= total",
            name="ck_invoices_amount_paid_range",
        ),
        CheckConstraint("period_end >= period_start", name="ck_invoices_period_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(String(20))
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="RESTRICT")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        pg_enum(InvoiceStatus, "invoice_status"), default=InvoiceStatus.DRAFT
    )
    invoice_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    # subtotal is before discount; tax is calculated after the discount, so
    # total = subtotal - discount_total + tax_total.
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount_total: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal(0), server_default="0"
    )
    tax_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal(0))
    # The admin discount applied when the invoice was generated (name copied).
    discount_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("discounts.id", ondelete="SET NULL")
    )
    discount_name: Mapped[str | None] = mapped_column(String(100))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    subscription: Mapped[Subscription] = relationship()
    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceLine.position",
    )
    payments: Mapped[list["Payment"]] = relationship(  # noqa: F821
        back_populates="invoice", order_by="Payment.paid_on"
    )

    @property
    def amount_due(self) -> Decimal:
        return self.total - self.amount_paid


class InvoiceLine(Base):
    """Copied from the subscription line when the invoice is generated."""

    __tablename__ = "invoice_lines"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(default=0)
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # This line's share of the invoice discount; tax is on subtotal - discount_amount.
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal(0), server_default="0"
    )
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    invoice: Mapped[Invoice] = relationship(back_populates="lines")
