import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.subscription import BillingFrequency, pg_enum


class QuotationTemplate(Base):
    """A reusable starting point for quotations: plan, lines, validity and terms.

    Using a template copies everything onto a new draft quotation, so later edits to the
    template never change quotations already created from it.
    """

    __tablename__ = "quotation_templates"
    __table_args__ = (
        UniqueConstraint("name", name="uq_quotation_templates_name"),
        CheckConstraint(
            "validity_days >= 1 AND validity_days <= 365",
            name="ck_quotation_templates_validity_range",
        ),
        CheckConstraint(
            "payment_terms_days >= 0", name="ck_quotation_templates_terms_non_negative"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subscription_plans.id", ondelete="SET NULL")
    )
    plan_name: Mapped[str] = mapped_column(String(200))
    billing_frequency: Mapped[BillingFrequency] = mapped_column(
        pg_enum(BillingFrequency, "billing_frequency")
    )
    validity_days: Mapped[int] = mapped_column(default=15)
    payment_terms_days: Mapped[int] = mapped_column(default=15)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["QuotationTemplateLine"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="QuotationTemplateLine.position",
    )


class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_quotation_template_lines_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_quotation_template_lines_price"),
        CheckConstraint(
            "tax_rate >= 0 AND tax_rate <= 100",
            name="ck_quotation_template_lines_tax_rate",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quotation_templates.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(default=0)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL")
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    is_plan_line: Mapped[bool] = mapped_column(default=False, server_default=false())
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal(0))

    template: Mapped[QuotationTemplate] = relationship(back_populates="lines")
