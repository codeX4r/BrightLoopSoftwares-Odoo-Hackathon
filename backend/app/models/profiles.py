"""Profile details kept outside `users`, so authentication stays separate from contact data.

CustomerProfile maps the `customer_profiles` table that already exists on Neon (created by
revision da1c3bc4ec7c, whose migration file has not been pushed to Git yet). The columns,
types, indexes and foreign key below were copied from the live table (read-only check on
31 Oct 2026), so this model does not change it.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[str | None] = mapped_column(String(200), index=True)
    company_name: Mapped[str | None] = mapped_column(String(200), index=True)
    phone: Mapped[str | None] = mapped_column(String(32))
    address: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class StaffProfile(Base):
    """Display name and phone for staff accounts. Same shape as the customer profile."""

    __tablename__ = "staff_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[str | None] = mapped_column(String(200), index=True)
    phone: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
