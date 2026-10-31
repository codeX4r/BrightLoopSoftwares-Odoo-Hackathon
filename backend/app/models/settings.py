"""Company settings: a single row (id = 1). Defaults keep today's behaviour: INR, IST and
INV- invoice numbers."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

DEFAULT_CURRENCY = "INR"
DEFAULT_TIMEZONE = "Asia/Kolkata"
DEFAULT_INVOICE_PREFIX = "INV"


class AppSettings(Base):
    __tablename__ = "app_settings"
    __table_args__ = (CheckConstraint("id = 1", name="ck_app_settings_single_row"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    company_name: Mapped[str] = mapped_column(
        String(200), default="Brightloop Software", server_default="Brightloop Software"
    )
    company_address: Mapped[str | None] = mapped_column(Text, default=None)
    company_email: Mapped[str | None] = mapped_column(String(320), default=None)
    company_phone: Mapped[str | None] = mapped_column(String(32), default=None)
    currency: Mapped[str] = mapped_column(
        String(3), default=DEFAULT_CURRENCY, server_default=DEFAULT_CURRENCY
    )
    timezone: Mapped[str] = mapped_column(
        String(64), default=DEFAULT_TIMEZONE, server_default=DEFAULT_TIMEZONE
    )
    # Prefix for new invoice numbers, e.g. INV -> INV-00042. Existing numbers never change.
    invoice_prefix: Mapped[str] = mapped_column(
        String(10),
        default=DEFAULT_INVOICE_PREFIX,
        server_default=DEFAULT_INVOICE_PREFIX,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
