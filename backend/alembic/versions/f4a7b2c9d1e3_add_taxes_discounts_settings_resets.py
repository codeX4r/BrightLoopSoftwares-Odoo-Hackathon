"""add taxes, discounts, settings, password reset tokens and staff profiles

Only creates new tables, enum types and indexes; no existing table is altered or dropped.
Seeds the default 5% GST tax and the single settings row (INR, Asia/Kolkata, INV prefix),
which keep today's behaviour.

customer_profiles is NOT created here: on Neon it belongs to revision da1c3bc4ec7c, whose
migration file has not been pushed to Git yet. See docs/api-contracts.md.

Revision ID: f4a7b2c9d1e3
Revises: e2b6c9f0a7d1
Create Date: 2026-10-31 14:00:00.000000

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f4a7b2c9d1e3"
down_revision: str | Sequence[str] | None = "e2b6c9f0a7d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DISCOUNT_TYPE = sa.Enum("FIXED", "PERCENTAGE", name="discount_type")
DISCOUNT_SCOPE = sa.Enum(
    "ENTIRE_SUBSCRIPTION", "SPECIFIC_PRODUCTS", name="discount_scope"
)


def _timestamps() -> list[sa.Column]:
    return [
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
    ]


def upgrade() -> None:
    """Upgrade schema."""
    # --- taxes ---
    op.create_table(
        "taxes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("rate", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("tax_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "is_default", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        *_timestamps(),
        sa.CheckConstraint("rate >= 0 AND rate <= 100", name="ck_taxes_rate_range"),
        sa.PrimaryKeyConstraint("id", name=op.f("taxes_pkey")),
        sa.UniqueConstraint("name", name=op.f("taxes_name_key")),
    )
    op.create_index(op.f("ix_taxes_is_active"), "taxes", ["is_active"], unique=False)
    op.create_index(
        "uq_taxes_single_default",
        "taxes",
        ["is_default"],
        unique=True,
        postgresql_where=sa.text("is_default"),
        sqlite_where=sa.text("is_default"),
    )
    op.create_table(
        "tax_products",
        sa.Column("tax_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("tax_products_product_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tax_id"],
            ["taxes.id"],
            name=op.f("tax_products_tax_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("tax_id", "product_id", name=op.f("tax_products_pkey")),
    )
    op.create_index(
        op.f("ix_tax_products_product_id"), "tax_products", ["product_id"], unique=False
    )
    op.create_table(
        "tax_product_types",
        sa.Column("tax_id", sa.Uuid(), nullable=False),
        sa.Column("product_type_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_type_id"],
            ["product_types.id"],
            name=op.f("tax_product_types_product_type_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tax_id"],
            ["taxes.id"],
            name=op.f("tax_product_types_tax_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "tax_id", "product_type_id", name=op.f("tax_product_types_pkey")
        ),
    )
    op.create_index(
        op.f("ix_tax_product_types_product_type_id"),
        "tax_product_types",
        ["product_type_id"],
        unique=False,
    )

    # --- discounts ---
    op.create_table(
        "discounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("discount_type", DISCOUNT_TYPE, nullable=False),
        sa.Column("value", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "min_purchase_amount", sa.Numeric(precision=12, scale=2), nullable=True
        ),
        sa.Column("min_quantity", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("usage_limit", sa.Integer(), nullable=True),
        sa.Column("usage_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("scope", DISCOUNT_SCOPE, nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("value > 0", name="ck_discounts_value_positive"),
        sa.CheckConstraint(
            "discount_type <> 'PERCENTAGE' OR value <= 100",
            name="ck_discounts_percentage_max",
        ),
        sa.CheckConstraint(
            "min_purchase_amount IS NULL OR min_purchase_amount >= 0",
            name="ck_discounts_min_purchase_nonneg",
        ),
        sa.CheckConstraint(
            "min_quantity IS NULL OR min_quantity >= 1",
            name="ck_discounts_min_quantity_positive",
        ),
        sa.CheckConstraint(
            "usage_limit IS NULL OR usage_limit >= 1",
            name="ck_discounts_usage_limit_positive",
        ),
        sa.CheckConstraint("usage_count >= 0", name="ck_discounts_usage_count_nonneg"),
        sa.CheckConstraint(
            "usage_limit IS NULL OR usage_count <= usage_limit",
            name="ck_discounts_usage_within_limit",
        ),
        sa.CheckConstraint(
            "end_date IS NULL OR end_date >= start_date",
            name="ck_discounts_dates_order",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("discounts_pkey")),
        sa.UniqueConstraint("name", name=op.f("discounts_name_key")),
    )
    op.create_index(
        op.f("ix_discounts_is_active"), "discounts", ["is_active"], unique=False
    )
    op.create_table(
        "discount_products",
        sa.Column("discount_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["discount_id"],
            ["discounts.id"],
            name=op.f("discount_products_discount_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name=op.f("discount_products_product_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "discount_id", "product_id", name=op.f("discount_products_pkey")
        ),
    )
    op.create_index(
        op.f("ix_discount_products_product_id"),
        "discount_products",
        ["product_id"],
        unique=False,
    )
    op.create_table(
        "discount_redemptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("discount_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "redeemed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("amount >= 0", name="ck_discount_redemptions_amount_nonneg"),
        sa.ForeignKeyConstraint(
            ["discount_id"],
            ["discounts.id"],
            name=op.f("discount_redemptions_discount_id_fkey"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id"],
            ["invoices.id"],
            name=op.f("discount_redemptions_invoice_id_fkey"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("discount_redemptions_pkey")),
        sa.UniqueConstraint(
            "discount_id", "invoice_id", name="uq_discount_redemptions_invoice"
        ),
    )
    op.create_index(
        op.f("ix_discount_redemptions_discount_id"),
        "discount_redemptions",
        ["discount_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_discount_redemptions_invoice_id"),
        "discount_redemptions",
        ["invoice_id"],
        unique=False,
    )

    # --- settings ---
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "company_name",
            sa.String(length=200),
            server_default="Brightloop Software",
            nullable=False,
        ),
        sa.Column("company_address", sa.Text(), nullable=True),
        sa.Column("company_email", sa.String(length=320), nullable=True),
        sa.Column("company_phone", sa.String(length=32), nullable=True),
        sa.Column(
            "currency", sa.String(length=3), server_default="INR", nullable=False
        ),
        sa.Column(
            "timezone",
            sa.String(length=64),
            server_default="Asia/Kolkata",
            nullable=False,
        ),
        sa.Column(
            "invoice_prefix", sa.String(length=10), server_default="INV", nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("id = 1", name="ck_app_settings_single_row"),
        sa.PrimaryKeyConstraint("id", name=op.f("app_settings_pkey")),
    )

    # --- password reset tokens ---
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("password_reset_tokens_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("password_reset_tokens_pkey")),
        sa.UniqueConstraint(
            "token_hash", name=op.f("password_reset_tokens_token_hash_key")
        ),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_user_id"),
        "password_reset_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_password_reset_tokens_expires_at"),
        "password_reset_tokens",
        ["expires_at"],
        unique=False,
    )

    # --- staff profiles ---
    op.create_table(
        "staff_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("staff_profiles_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("staff_profiles_pkey")),
    )
    op.create_index(
        op.f("ix_staff_profiles_full_name"),
        "staff_profiles",
        ["full_name"],
        unique=False,
    )

    # --- seed rows that keep today's behaviour ---
    op.bulk_insert(sa.table("app_settings", sa.column("id", sa.Integer)), [{"id": 1}])
    op.bulk_insert(
        sa.table(
            "taxes",
            sa.column("id", sa.Uuid),
            sa.column("name", sa.String),
            sa.column("rate", sa.Numeric),
            sa.column("tax_type", sa.String),
            sa.column("description", sa.Text),
            sa.column("is_active", sa.Boolean),
            sa.column("is_default", sa.Boolean),
        ),
        [
            {
                "id": uuid.UUID("5e2b8f6a-0c1d-4a7e-9b3f-2d6c8e1a4b70"),
                "name": "GST 5%",
                "rate": 5,
                "tax_type": "GST",
                "description": "Initial default tax rate for the project.",
                "is_active": True,
                "is_default": True,
            }
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_staff_profiles_full_name"), table_name="staff_profiles")
    op.drop_table("staff_profiles")
    op.drop_index(
        op.f("ix_password_reset_tokens_expires_at"), table_name="password_reset_tokens"
    )
    op.drop_index(
        op.f("ix_password_reset_tokens_user_id"), table_name="password_reset_tokens"
    )
    op.drop_table("password_reset_tokens")
    op.drop_table("app_settings")
    op.drop_index(
        op.f("ix_discount_redemptions_invoice_id"), table_name="discount_redemptions"
    )
    op.drop_index(
        op.f("ix_discount_redemptions_discount_id"), table_name="discount_redemptions"
    )
    op.drop_table("discount_redemptions")
    op.drop_index(
        op.f("ix_discount_products_product_id"), table_name="discount_products"
    )
    op.drop_table("discount_products")
    op.drop_index(op.f("ix_discounts_is_active"), table_name="discounts")
    op.drop_table("discounts")
    op.drop_index(
        op.f("ix_tax_product_types_product_type_id"), table_name="tax_product_types"
    )
    op.drop_table("tax_product_types")
    op.drop_index(op.f("ix_tax_products_product_id"), table_name="tax_products")
    op.drop_table("tax_products")
    op.drop_index("uq_taxes_single_default", table_name="taxes")
    op.drop_index(op.f("ix_taxes_is_active"), table_name="taxes")
    op.drop_table("taxes")
    bind = op.get_bind()
    DISCOUNT_SCOPE.drop(bind, checkfirst=True)
    DISCOUNT_TYPE.drop(bind, checkfirst=True)
