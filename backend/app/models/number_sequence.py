from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NumberSequence(Base):
    """Counters for human-readable document numbers (SUB-00001, INV-00001).

    The row is locked while a number is taken, so concurrent requests never get the
    same number. Works the same on Postgres and on the SQLite test database.
    """

    __tablename__ = "number_sequences"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    next_value: Mapped[int] = mapped_column(default=1)
