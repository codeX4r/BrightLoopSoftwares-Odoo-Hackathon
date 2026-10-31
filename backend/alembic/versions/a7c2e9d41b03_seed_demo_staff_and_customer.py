"""seed demo staff and customer accounts

Creates the demo STAFF and CUSTOMER accounts so every database built from migrations has
them. Existing accounts with the same email are left unchanged, so re-running is safe.

Passwords are hashed with Argon2 here and never stored in plain text. The matching
credentials are published in the root readme.md, so never run this against a production
database.

Revision ID: a7c2e9d41b03
Revises: 3c1d6b2a9e47
Create Date: 2026-10-31 13:00:00.000000

"""

import uuid
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from argon2 import PasswordHasher

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c2e9d41b03"
down_revision: Union[str, Sequence[str], None] = "3c1d6b2a9e47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO_ACCOUNTS = [
    ("staff@brightloop.com", "Staff@Brightloop2026", "STAFF"),
    ("customer@brightloop.com", "Customer@Brightloop2026", "CUSTOMER"),
]

INSERT_IF_MISSING = sa.text(
    """
    INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
    SELECT
        CAST(:id AS UUID),
        CAST(:email AS VARCHAR(320)),
        CAST(:password_hash AS VARCHAR(255)),
        CAST(:role AS user_role),
        true,
        now(),
        now()
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = :email)
    """
)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    hasher = PasswordHasher()
    for email, password, role in DEMO_ACCOUNTS:
        bind.execute(
            INSERT_IF_MISSING,
            {
                "id": uuid.uuid4(),
                "email": email,
                "password_hash": hasher.hash(password),
                "role": role,
            },
        )


def downgrade() -> None:
    """Downgrade schema.

    Intentionally a no-op. Removing rows on downgrade could delete accounts that someone
    has since used or changed.
    """
