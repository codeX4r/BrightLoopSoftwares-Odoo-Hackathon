"""seed admin account from environment

Creates an ADMIN account when SEED_ADMIN_PASSWORD is set. The password is read from the
environment and never written to this file. If the variable is not set, the migration
skips the admin and continues. An existing account with the same email is left unchanged.

    SEED_ADMIN_PASSWORD='...' uv run alembic upgrade head

Optional: SEED_ADMIN_EMAIL (default admin@brightloop.com).

Revision ID: c5d19f2e8a64
Revises: a7c2e9d41b03
Create Date: 2026-10-31 14:00:00.000000

"""

import os
import uuid
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from argon2 import PasswordHasher

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c5d19f2e8a64"
down_revision: Union[str, Sequence[str], None] = "a7c2e9d41b03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MIN_PASSWORD_LENGTH = 12

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
    password = os.environ.get("SEED_ADMIN_PASSWORD", "")
    if not password:
        print("SEED_ADMIN_PASSWORD not set; skipping admin seed.")
        return
    if len(password) < MIN_PASSWORD_LENGTH:
        raise RuntimeError(
            f"SEED_ADMIN_PASSWORD must be at least {MIN_PASSWORD_LENGTH} characters."
        )

    email = os.environ.get("SEED_ADMIN_EMAIL", "admin@brightloop.com").strip().lower()
    op.get_bind().execute(
        INSERT_IF_MISSING,
        {
            "id": uuid.uuid4(),
            "email": email,
            "password_hash": PasswordHasher().hash(password),
            "role": "ADMIN",
        },
    )


def downgrade() -> None:
    """Downgrade schema.

    Intentionally a no-op so downgrading never deletes an account.
    """
