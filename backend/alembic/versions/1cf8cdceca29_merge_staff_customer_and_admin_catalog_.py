"""merge staff/customer and admin catalog migrations

Joins the two branches that both started from 87bb5817633c:
- da1c3bc4ec7c (staff/customer): customer_profiles, quotation decline columns.
- e2b6c9f0a7d1 -> f4a7b2c9d1e3 (admin): catalog, taxes, discounts, settings,
  staff profiles, password reset tokens.
No schema changes of its own.

Revision ID: 1cf8cdceca29
Revises: da1c3bc4ec7c, f4a7b2c9d1e3
Create Date: 2026-10-31 14:12:47.146550

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "1cf8cdceca29"
down_revision: str | Sequence[str] | None = ("da1c3bc4ec7c", "f4a7b2c9d1e3")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Merge point only."""


def downgrade() -> None:
    """Merge point only."""
