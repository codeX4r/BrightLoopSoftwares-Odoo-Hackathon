"""Catalog tables: product types, products, variants and subscription plans.

Money columns are Numeric(12, 2) in INR. Prices are copied onto subscriptions and invoices
when they are created, so changing a catalog price never changes historical amounts.
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
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProductStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class PlanStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class BillingFrequency(enum.StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


def _enum(enum_class: type[enum.Enum], name: str) -> Enum:
    return Enum(enum_class, name=name, values_callable=lambda e: [m.value for m in e])


plan_products = Table(
    "plan_products",
    Base.metadata,
    Column(
        "plan_id",
        Uuid,
        ForeignKey("subscription_plans.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "product_id",
        Uuid,
        ForeignKey("products.id", ondelete="RESTRICT"),
        primary_key=True,
        index=True,
    ),
)


class ProductType(Base):
    """Admin-configurable product categories (for example Service, Good, Bundle)."""

    __tablename__ = "product_types"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("name", name="uq_products_name"),
        CheckConstraint("sales_price >= 0", name="ck_products_sales_price_nonneg"),
        CheckConstraint("cost_price >= 0", name="ck_products_cost_price_nonneg"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    product_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_types.id", ondelete="RESTRICT"), index=True
    )
    sales_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[ProductStatus] = mapped_column(
        _enum(ProductStatus, "product_status"),
        default=ProductStatus.ACTIVE,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product_type: Mapped[ProductType] = relationship(lazy="joined")
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product",
        order_by="ProductVariant.name",
        cascade="all, delete-orphan",
    )


class ProductVariant(Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "name", name="uq_product_variants_product_name"),
        CheckConstraint(
            "additional_price >= 0", name="ck_product_variants_additional_price_nonneg"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    additional_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), server_default="0"
    )
    description: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[ProductStatus] = mapped_column(
        _enum(ProductStatus, "product_status"),
        default=ProductStatus.ACTIVE,
    )

    product: Mapped[Product] = relationship(back_populates="variants")


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        UniqueConstraint("name", name="uq_subscription_plans_name"),
        CheckConstraint("price >= 0", name="ck_subscription_plans_price_nonneg"),
        CheckConstraint(
            "minimum_quantity >= 1", name="ck_subscription_plans_min_quantity_positive"
        ),
        CheckConstraint(
            "available_until IS NULL OR available_until >= available_from",
            name="ck_subscription_plans_dates_order",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        _enum(BillingFrequency, "billing_frequency")
    )
    minimum_quantity: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )
    available_from: Mapped[date] = mapped_column(Date)
    available_until: Mapped[date | None] = mapped_column(Date, default=None)
    auto_close_on_expiry: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    allow_early_closure: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    allow_pause: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    allow_renewal: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    status: Mapped[PlanStatus] = mapped_column(
        _enum(PlanStatus, "plan_status"), default=PlanStatus.ACTIVE, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    products: Mapped[list[Product]] = relationship(
        secondary=plan_products, lazy="selectin"
    )
