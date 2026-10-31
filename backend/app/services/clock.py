"""Business dates are in India time, so "today" doesn't flip at 05:30 IST on a UTC server."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

BUSINESS_TIMEZONE = ZoneInfo("Asia/Kolkata")


def today() -> date:
    return datetime.now(BUSINESS_TIMEZONE).date()


def now_utc() -> datetime:
    return datetime.now(UTC)
