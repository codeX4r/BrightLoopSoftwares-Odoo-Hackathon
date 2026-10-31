"""Money arithmetic. Always Decimal, rounded half-up to paise, never float."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


def round_money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineAmounts:
    subtotal: Decimal
    tax: Decimal
    total: Decimal


def line_amounts(quantity: int, unit_price: Decimal, tax_rate: Decimal) -> LineAmounts:
    """Tax is computed per line on the rounded subtotal, so invoice totals add up exactly."""
    subtotal = round_money(Decimal(quantity) * unit_price)
    tax = round_money(subtotal * tax_rate / Decimal(100))
    return LineAmounts(subtotal=subtotal, tax=tax, total=subtotal + tax)
