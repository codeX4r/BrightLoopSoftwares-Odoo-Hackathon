from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.number_sequence import NumberSequence
from app.models.settings import AppSettings

SUBSCRIPTION_SEQUENCE = ("subscription", "SUB")
INVOICE_SEQUENCE = ("invoice", "INV")


def next_number(db: Session, sequence: tuple[str, str]) -> str:
    """Reserves the next number in the caller's transaction, e.g. "SUB-00042".

    The sequence row stays locked until the caller commits or rolls back, so two
    transactions can't take the same number. A rolled-back transaction gives its
    number back.
    """
    name, prefix = sequence
    if name == INVOICE_SEQUENCE[0]:
        # Admin-configurable prefix (Settings). Defaults to "INV"; the counter is shared,
        # so a new prefix never collides with existing numbers, which stay unchanged.
        settings_row = db.get(AppSettings, 1)
        if settings_row is not None and settings_row.invoice_prefix:
            prefix = settings_row.invoice_prefix
    row = db.scalar(
        select(NumberSequence).where(NumberSequence.name == name).with_for_update()
    )
    if row is None:
        # Postgres rows are created by the migration; this covers fresh test databases.
        row = NumberSequence(name=name, next_value=1)
        db.add(row)
        db.flush()
    value = row.next_value
    row.next_value = value + 1
    return f"{prefix}-{value:05d}"
