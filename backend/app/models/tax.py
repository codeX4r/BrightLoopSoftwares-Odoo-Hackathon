"""Admin-configured tax rules.

Calculation is always a percentage of a line's subtotal (see app.services.money). Rates are
copied onto subscription and invoice lines when those are created, so editing or
deactivating a tax never changes an existing quotation or invoice.

Which tax applies to a product: a tax assigned to the product, otherwise one assigned to
its product type, otherwise the default tax (see tax_service.resolve_tax).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Table,
    Text,
    Uuid,
    false,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.catalog import Product, ProductType

tax_products = Table(
    "tax_products",
    Base.metadata,
    Column(
        "tax_id", Uuid, ForeignKey("taxes.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "product_id",
        Uuid,
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)

tax_product_types = Table(
    "tax_product_types",
    Base.metadata,
    Column(
        "tax_id", Uuid, ForeignKey("taxes.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "product_type_id",
        Uuid,
        ForeignKey("product_types.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
)


class Tax(Base):
    __tablename__ = "taxes"
    __table_args__ = (
        CheckConstraint("rate >= 0 AND rate <= 100", name="ck_taxes_rate_range"),
        # At most one default tax. Partial unique index works on Postgres and SQLite.
        Index(
            "uq_taxes_single_default",
            "is_default",
            unique=True,
            postgresql_where=text("is_default"),
            sqlite_where=text("is_default"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Stored as entered; uniqueness is checked case-insensitively in the service.
    name: Mapped[str] = mapped_column(String(100), unique=True)
    # Percentage, e.g. 5.00 for 5% GST.
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    # A label such as "GST" or "CGST". Calculation is always percentage-based.
    tax_type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), index=True
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    products: Mapped[list[Product]] = relationship(
        secondary=tax_products, lazy="selectin"
    )
    product_types: Mapped[list[ProductType]] = relationship(
        secondary=tax_product_types, lazy="selectin"
    )
