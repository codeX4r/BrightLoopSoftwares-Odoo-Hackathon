"""Company settings, stored in the single app_settings row.

What each setting affects today:
- company_*: stored and returned for screens and documents to display.
- invoice_prefix: used for NEW invoice numbers (numbering.invoice_sequence). Existing
  invoice numbers are stored on the invoice and never change.
- currency, timezone: stored and validated. Billing still calculates in INR and uses
  India time (app.services.clock); changing these is limited to the defaults until the
  team decides how existing invoices should be shown (see docs/api-contracts.md).
"""

import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.settings import DEFAULT_CURRENCY, DEFAULT_TIMEZONE, AppSettings
from app.services.errors import InvalidInputError

PREFIX_PATTERN = re.compile(r"^[A-Z][A-Z0-9]{0,9}$")
# Values the billing code supports today. Others are refused instead of silently ignored.
SUPPORTED_CURRENCIES = {DEFAULT_CURRENCY}
SUPPORTED_TIMEZONES = {DEFAULT_TIMEZONE}


def get_settings_row(db: Session) -> AppSettings:
    """Returns the settings row, creating it with defaults if it is missing."""
    row = db.get(AppSettings, 1)
    if row is None:
        row = AppSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def invoice_prefix(db: Session) -> str:
    row = db.get(AppSettings, 1)
    return row.invoice_prefix if row is not None else "INV"


def update_settings(db: Session, changes: dict) -> AppSettings:
    row = get_settings_row(db)
    if changes.get("invoice_prefix") is not None:
        prefix = changes["invoice_prefix"].strip().upper()
        if not PREFIX_PATTERN.match(prefix):
            raise InvalidInputError(
                "Invoice prefix must be 1-10 letters or digits and start with a letter."
            )
        changes["invoice_prefix"] = prefix
    if changes.get("currency") is not None:
        currency = changes["currency"].strip().upper()
        if currency not in SUPPORTED_CURRENCIES:
            raise InvalidInputError(
                f"Only {', '.join(sorted(SUPPORTED_CURRENCIES))} is supported right now."
            )
        changes["currency"] = currency
    if changes.get("timezone") is not None:
        tz = changes["timezone"].strip()
        try:
            ZoneInfo(tz)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise InvalidInputError("Unknown time zone.") from exc
        if tz not in SUPPORTED_TIMEZONES:
            raise InvalidInputError(
                f"Only {', '.join(sorted(SUPPORTED_TIMEZONES))} is supported right now."
            )
        changes["timezone"] = tz
    if changes.get("company_name") is not None:
        name = changes["company_name"].strip()
        if not name:
            raise InvalidInputError("Company name is required.")
        changes["company_name"] = name

    nullable = {"company_address", "company_email", "company_phone"}
    for field_name, value in changes.items():
        if isinstance(value, str) and field_name in nullable:
            value = value.strip() or None
        if value is not None or field_name in nullable:
            setattr(row, field_name, value)
    db.commit()
    db.refresh(row)
    return row
