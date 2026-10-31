"""Daily billing job: generates every invoice that is due.

    uv run python -m app.jobs.billing                 # bill everything due today
    uv run python -m app.jobs.billing --as-of 2026-11-01

Safe to run more than once a day; already-billed periods are skipped. Schedule it once
a day (for example as a Render cron job).
"""

import argparse
import sys
from datetime import date

from app.db.session import SessionLocal
from app.services import billing_service, clock


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.jobs.billing")
    parser.add_argument(
        "--as-of",
        type=date.fromisoformat,
        default=None,
        help="Bill periods due on or before this date (YYYY-MM-DD). Default: today.",
    )
    args = parser.parse_args(argv)

    today = clock.today()
    as_of = args.as_of or today
    if as_of > today:
        print("--as-of cannot be in the future.", file=sys.stderr)
        return 2

    with SessionLocal() as db:
        run = billing_service.generate_due_invoices(db, as_of)
    print(
        f"Billing run for {run.as_of.isoformat()}: {len(run.invoice_numbers)} invoice(s) "
        f"for {run.subscriptions_billed} subscription(s)."
    )
    for number in run.invoice_numbers:
        print(f"  {number}")
    if run.auto_closed:
        print(f"Closed after expiry: {', '.join(run.auto_closed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
