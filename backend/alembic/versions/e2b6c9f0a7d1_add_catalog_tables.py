"""add catalog tables: product types, products, variants, subscription plans

Revision ID: e2b6c9f0a7d1
Revises: d8f4a1c2b7e9
Create Date: 2026-10-31 16:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2b6c9f0a7d1"
down_revision: Union[str, Sequence[str], None] = "d8f4a1c2b7e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PRODUCT_STATUS = ("ACTIVE", "ARCHIVED")
PLAN_STATUS = ("ACTIVE", "INACTIVE", "ARCHIVED")
BILLING_FREQUENCY = ("DAILY", "WEEKLY", "MONTHLY", "YEARLY")


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "product_types",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("product_types_pkey")),
        sa.UniqueConstraint("name", name=op.f("product_types_name_key")),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("product_type_id", sa.Uuid(), nullable=False),
        sa.Column("sales_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("cost_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(*PRODUCT_STATUS, name="product_status"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("sales_price >= 0", name="ck_products_sales_price_nonneg"),
        sa.CheckConstraint("cost_price >= 0", name="ck_products_cost_price_nonneg"),
        sa.ForeignKeyConstraint(
            ["product_type_id"],
            ["product_types.id"],
            name=op.f("products_product_type_id_fkey"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("products_pkey")),
        sa.UniqueConstraint("name", name="uq_products_name"),
    )
    op.create_index(
        op.f("ix_products_product_type_id"), "products", ["product_type_id"], unique=False
    )
    op.create_index(op.f("ix_products_status"), "products", ["status"], unique=False)

    op.create_table(
        "product_variants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "additional_price",
            sa.Numeric(precision=12, scale=2),
            server_default="0",
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(*PRODUCT_STATUS, name="product_status", create_type=False),
            nullable=False,
        ),
        sa.CheckConstraint(
            "additional_price >= 0",
            name="ck_product_variants_additional_price_nonneg",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("product_variants_product_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("product_variants_pkey")),
        sa.UniqueConstraint("product_id", "name", name="uq_product_variants_product_name"),
    )
    op.create_index(
        op.f("ix_product_variants_product_id"),
        "product_variants",
        ["product_id"],
        unique=False,
    )

    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "billing_frequency",
            sa.Enum(*BILLING_FREQUENCY, name="billing_frequency"),
            nullable=False,
        ),
        sa.Column("minimum_quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("available_from", sa.Date(), nullable=False),
        sa.Column("available_until", sa.Date(), nullable=True),
        sa.Column(
            "auto_close_on_expiry",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "allow_early_closure",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("allow_pause", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("allow_renewal", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("status", sa.Enum(*PLAN_STATUS, name="plan_status"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("price >= 0", name="ck_subscription_plans_price_nonneg"),
        sa.CheckConstraint(
            "minimum_quantity >= 1",
            name="ck_subscription_plans_min_quantity_positive",
        ),
        sa.CheckConstraint(
            "available_until IS NULL OR available_until >= available_from",
            name="ck_subscription_plans_dates_order",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("subscription_plans_pkey")),
        sa.UniqueConstraint("name", name="uq_subscription_plans_name"),
    )
    op.create_index(
        op.f("ix_subscription_plans_status"),
        "subscription_plans",
        ["status"],
        unique=False,
    )

    op.create_table(
        "plan_products",
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["subscription_plans.id"],
            name=op.f("plan_products_plan_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("plan_products_product_id_fkey"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("plan_id", "product_id", name=op.f("plan_products_pkey")),
    )
    op.create_index(
        op.f("ix_plan_products_product_id"),
        "plan_products",
        ["product_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_plan_products_product_id"), table_name="plan_products")
    op.drop_table("plan_products")

    op.drop_index(op.f("ix_subscription_plans_status"), table_name="subscription_plans")
    op.drop_table("subscription_plans")

    op.drop_index(op.f("ix_product_variants_product_id"), table_name="product_variants")
    op.drop_table("product_variants")

    op.drop_index(op.f("ix_products_status"), table_name="products")
    op.drop_index(op.f("ix_products_product_type_id"), table_name="products")
    op.drop_table("products")

    op.drop_table("product_types")

    bind = op.get_bind()
    sa.Enum(name="billing_frequency").drop(bind, checkfirst=True)
    sa.Enum(name="plan_status").drop(bind, checkfirst=True)
    sa.Enum(name="product_status").drop(bind, checkfirst=True)
