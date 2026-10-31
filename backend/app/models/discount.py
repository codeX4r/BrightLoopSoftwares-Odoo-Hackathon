"""Admin-configured discount rules and their redemptions.

Agreed behaviour (see docs/api-contracts.md):
- Discounts are applied to the pre-tax subtotal; tax is calculated after the discount.
- One discount per invoice (no stacking): the largest eligible discount wins.
- A use is counted when an invoice is confirmed, by recording a DiscountRedemption.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.catalog import Product
from app.models.subscription import pg_enum


class DiscountType(enum.StrEnum):
    FIXED = "FIXED"
    PERCENTAGE = "PERCENTAGE"


class DiscountScope(enum.StrEnum):
    # Applies to the whole subscription subtotal.
    ENTIRE_SUBSCRIPTION = "ENTIRE_SUBSCRIPTION"
    # Applies only to lines for the selected products.
    SPECIFIC_PRODUCTS = "SPECIFIC_PRODUCTS"


discount_products = Table(
    "discount_products",
    Base.metadata,
    Column(
        "discount_id",
        Uuid,
        ForeignKey("discounts.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "product_id",
        Uuid,
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


class Discount(Base):
    __tablename__ = "discounts"
    __table_args__ = (
        CheckConstraint("value > 0", name="ck_discounts_value_positive"),
        CheckConstraint(
            "discount_type <> 'PERCENTAGE' OR value <= 100",
            name="ck_discounts_percentage_max",
        ),
        CheckConstraint(
            "min_purchase_amount IS NULL OR min_purchase_amount >= 0",
            name="ck_discounts_min_purchase_nonneg",
        ),
        CheckConstraint(
            "min_quantity IS NULL OR min_quantity >= 1",
            name="ck_discounts_min_quantity_positive",
        ),
        CheckConstraint(
            "usage_limit IS NULL OR usage_limit >= 1",
            name="ck_discounts_usage_limit_positive",
        ),
        CheckConstraint("usage_count >= 0", name="ck_discounts_usage_count_nonneg"),
        # The database itself refuses to count past the limit.
        CheckConstraint(
            "usage_limit IS NULL OR usage_count <= usage_limit",
            name="ck_discounts_usage_within_limit",
        ),
        CheckConstraint(
            "end_date IS NULL OR end_date >= start_date",
            name="ck_discounts_dates_order",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    discount_type: Mapped[DiscountType] = mapped_column(
        pg_enum(DiscountType, "discount_type")
    )
    # Rupees for FIXED, percent for PERCENTAGE.
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    min_purchase_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), default=None
    )
    min_quantity: Mapped[int | None] = mapped_column(Integer, default=None)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, default=None)
    usage_limit: Mapped[int | None] = mapped_column(Integer, default=None)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    scope: Mapped[DiscountScope] = mapped_column(
        pg_enum(DiscountScope, "discount_scope")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    products: Mapped[list[Product]] = relationship(
        secondary=discount_products, lazy="selectin"
    )


class DiscountRedemption(Base):
    """One counted use of a discount. Unique per invoice, so a use is never counted twice."""

    __tablename__ = "discount_redemptions"
    __table_args__ = (
        UniqueConstraint(
            "discount_id", "invoice_id", name="uq_discount_redemptions_invoice"
        ),
        CheckConstraint("amount >= 0", name="ck_discount_redemptions_amount_nonneg"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    discount_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("discounts.id", ondelete="RESTRICT"), index=True
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    redeemed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
