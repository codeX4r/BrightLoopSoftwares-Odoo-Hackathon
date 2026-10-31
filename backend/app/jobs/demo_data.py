"""Temporary demo data for testing the staff panel and customer portal.

    uv run python -m app.jobs.demo_data            # create (refuses if it already exists)
    uv run python -m app.jobs.demo_data --reset    # remove the demo data, then create it again
    uv run python -m app.jobs.demo_data --remove   # remove the demo data only
    uv run python -m app.jobs.demo_data --customers 80   # more history (default 40)

Creates six named "story" customers covering every lifecycle case, plus a bulk set of
customers with backdated subscriptions, invoices and payments over the past year, so the
dashboards look like a running business.

Everything belongs to accounts under @demo.brightloop.com, so --remove deletes exactly
that data and nothing else. Never runs when ENVIRONMENT=production.

Logins created (all customers share one password):
    staff@demo.brightloop.com     Staff@Demo2026
    <name>@demo.brightloop.com    Customer@Demo2026
"""

import argparse
import sys
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.jobs.demo_bulk import create_bulk
from app.models.invoice import Invoice
from app.models.payment import Payment, PaymentMethod
from app.models.subscription import BillingFrequency, Subscription
from app.models.user import User, UserRole
from app.schemas.customer import StaffCustomerCreate
from app.schemas.payment import PaymentCreate
from app.schemas.subscription import SubscriptionCreate, SubscriptionLineIn
from app.services import (
    billing_service,
    clock,
    customer_service,
    invoice_service,
    payment_service,
    subscription_service,
    user_service,
)

DEMO_DOMAIN = "demo.brightloop.com"
STAFF_EMAIL = f"staff@{DEMO_DOMAIN}"
STAFF_PASSWORD = "Staff@Demo2026"
CUSTOMER_PASSWORD = "Customer@Demo2026"

CUSTOMERS = [
    # (local part, full name, company, phone, address)
    (
        "aarav",
        "Aarav Sharma",
        "ABC Technologies",
        "+91 98100 11111",
        "Sector 62, Noida",
    ),
    ("priya", "Priya Verma", "Nimbus Retail", "+91 98100 22222", "Hazratganj, Lucknow"),
    (
        "rohan",
        "Rohan Gupta",
        "Gupta Logistics",
        "+91 98100 33333",
        "Andheri East, Mumbai",
    ),
    (
        "neha",
        "Neha Iyer",
        "Iyer Design Studio",
        "+91 98100 44444",
        "Indiranagar, Bengaluru",
    ),
    ("kabir", "Kabir Mehta", None, "+91 98100 55555", "Gomti Nagar, Lucknow"),
    ("ananya", "Ananya Rao", "Rao & Sons", None, None),
]
# A self-registered customer who hasn't filled in a profile or been quoted yet.
NEW_CUSTOMER = f"new@{DEMO_DOMAIN}"


def _line(
    description: str, quantity: int, price: str, tax: str = "18"
) -> SubscriptionLineIn:
    return SubscriptionLineIn(
        description=description,
        quantity=quantity,
        unit_price=Decimal(price),
        tax_rate=Decimal(tax),
    )


def _demo_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).where(User.email.like(f"%@{DEMO_DOMAIN}"))))


def remove(db: Session) -> int:
    users = _demo_users(db)
    ids = [u.id for u in users]
    if not ids:
        return 0
    invoice_ids = select(Invoice.id).where(Invoice.customer_id.in_(ids))
    db.execute(delete(Payment).where(Payment.invoice_id.in_(invoice_ids)))
    db.execute(delete(Invoice).where(Invoice.customer_id.in_(ids)))
    db.execute(delete(Subscription).where(Subscription.customer_id.in_(ids)))
    db.execute(delete(User).where(User.id.in_(ids)))
    db.commit()
    return len(ids)


def _quotation(db: Session, staff: User, customer_id, plan: str, freq, lines, **kw):
    return subscription_service.create_subscription(
        db,
        SubscriptionCreate(
            customer_id=customer_id,
            plan_name=plan,
            billing_frequency=freq,
            payment_terms_days=kw.get("terms", 15),
            notes=kw.get("notes"),
            lines=lines,
        ),
        actor=staff,
    )


def _activate(
    db: Session, staff: User, customer: User, plan, freq, lines, start: date, **kw
):
    sub = _quotation(db, staff, customer.id, plan, freq, lines, **kw)
    subscription_service.send_quotation(db, sub.id, valid_days=15)
    subscription_service.confirm(db, sub.id, customer_id=customer.id)
    subscription_service.activate(
        db, sub.id, start_date=start, expiry_date=kw.get("expiry")
    )
    billing_service.bill_subscription(db, sub.id, clock.today())
    return sub


def _invoices(db: Session, sub_id) -> list[Invoice]:
    return list(
        db.scalars(
            select(Invoice)
            .where(Invoice.subscription_id == sub_id)
            .order_by(Invoice.period_start)
        )
    )


def _pay(
    db: Session,
    staff: User,
    invoice: Invoice,
    amount: str,
    method,
    paid_on: date,
    ref=None,
):
    payment_service.record_payment(
        db,
        PaymentCreate(
            invoice_id=invoice.id,
            amount=Decimal(amount),
            method=method,
            paid_on=min(paid_on, clock.today()),
            reference=ref,
        ),
        actor=staff,
    )


def create(db: Session) -> None:
    today = clock.today()
    staff = user_service.create_user(
        db, email=STAFF_EMAIL, password=STAFF_PASSWORD, role=UserRole.STAFF
    )
    customers: dict[str, User] = {}
    for local, name, company, phone, address in CUSTOMERS:
        detail = customer_service.create_customer(
            db,
            StaffCustomerCreate(
                email=f"{local}@{DEMO_DOMAIN}",
                password=CUSTOMER_PASSWORD,
                full_name=name,
                company_name=company,
                phone=phone,
                address=address,
            ),
        )
        customers[local] = db.get(User, detail.id)
    user_service.create_user(
        db, email=NEW_CUSTOMER, password=CUSTOMER_PASSWORD, role=UserRole.CUSTOMER
    )

    # Aarav: monthly Enterprise for 10 seats since ~2.5 months ago. Oldest invoice paid,
    # the next part-paid, the latest confirmed and unpaid, so overdue.
    sub = _activate(
        db,
        staff,
        customers["aarav"],
        "Enterprise Plan",
        BillingFrequency.MONTHLY,
        [
            _line("Enterprise Plan (per seat)", 10, "5000"),
            _line("Priority support add-on", 2, "500"),
        ],
        start=today - timedelta(days=77),
        terms=15,
        notes="Annual review in March. Invoices to accounts@abctech.example.",
    )
    inv = _invoices(db, sub.id)
    for invoice in inv:
        invoice_service.confirm(db, invoice.id)
    if inv:
        _pay(
            db,
            staff,
            inv[0],
            str(db.get(Invoice, inv[0].id).total),
            PaymentMethod.BANK_TRANSFER,
            inv[0].due_date,
            "UTR4471209",
        )
    if len(inv) > 1:
        _pay(
            db,
            staff,
            inv[1],
            "30000.00",
            PaymentMethod.UPI,
            inv[1].due_date,
            "UPI-882113",
        )
    if len(inv) > 2:
        invoice_service.mark_sent(db, inv[2].id)

    # Priya: an open quotation to accept or reject in the portal, plus a draft.
    sub = _quotation(
        db,
        staff,
        customers["priya"].id,
        "Professional Plan",
        BillingFrequency.MONTHLY,
        [
            _line("Professional Plan (per seat)", 5, "1999"),
            _line("Onboarding (one-off)", 1, "2500"),
        ],
        notes="Includes a one-time onboarding session.",
    )
    subscription_service.send_quotation(db, sub.id, valid_days=15)
    _quotation(
        db,
        staff,
        customers["priya"].id,
        "Basic Plan",
        BillingFrequency.MONTHLY,
        [_line("Basic Plan (per seat)", 3, "999")],
        notes="Draft alternative, not sent yet.",
    )

    # Rohan: accepted, waiting for staff to activate.
    sub = _quotation(
        db,
        staff,
        customers["rohan"].id,
        "Enterprise Plan (Yearly)",
        BillingFrequency.YEARLY,
        [_line("Enterprise Plan, annual", 1, "25000")],
        terms=30,
    )
    subscription_service.send_quotation(db, sub.id, valid_days=30)
    subscription_service.confirm(db, sub.id, customer_id=customers["rohan"].id)

    # Neha: declined a quotation, with a reason staff can see.
    sub = _quotation(
        db,
        staff,
        customers["neha"].id,
        "Professional Plan",
        BillingFrequency.MONTHLY,
        [_line("Professional Plan (per seat)", 8, "1999")],
    )
    subscription_service.send_quotation(db, sub.id, valid_days=15)
    subscription_service.reject(
        db,
        sub.id,
        customer_id=customers["neha"].id,
        reason="Budget is approved only from next quarter.",
    )

    # Kabir: weekly plan for this month; most weeks paid, the latest still a draft.
    sub = _activate(
        db,
        staff,
        customers["kabir"],
        "Starter Weekly",
        BillingFrequency.WEEKLY,
        [_line("Starter Plan, weekly", 1, "499")],
        start=today - timedelta(days=30),
        terms=7,
    )
    inv = _invoices(db, sub.id)
    for invoice in inv[:-1]:
        invoice_service.confirm(db, invoice.id)
        _pay(
            db,
            staff,
            invoice,
            str(db.get(Invoice, invoice.id).total),
            PaymentMethod.CARD,
            invoice.invoice_date,
        )

    # Ananya: a subscription that ran with an expiry date and is now closed.
    sub = _activate(
        db,
        staff,
        customers["ananya"],
        "Basic Plan",
        BillingFrequency.MONTHLY,
        [_line("Basic Plan (per seat)", 2, "999")],
        start=today - timedelta(days=95),
        expiry=today - timedelta(days=35),
        terms=10,
    )
    for invoice in _invoices(db, sub.id):
        invoice_service.confirm(db, invoice.id)
        _pay(
            db,
            staff,
            invoice,
            str(db.get(Invoice, invoice.id).total),
            PaymentMethod.CASH,
            invoice.invoice_date,
        )
    subscription_service.close(db, sub.id)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.jobs.demo_data")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset", action="store_true", help="Remove, then create again")
    group.add_argument(
        "--remove", action="store_true", help="Remove the demo data only"
    )
    parser.add_argument(
        "--customers",
        type=int,
        default=40,
        help="Extra customers with a year of history (default 40; 0 for none)",
    )
    args = parser.parse_args(argv)

    if get_settings().environment == "production":
        print(
            "Refusing to touch demo data when ENVIRONMENT=production.", file=sys.stderr
        )
        return 2

    with SessionLocal() as db:
        if args.remove or args.reset:
            print(f"Removed {remove(db)} demo account(s) and their records.")
            if args.remove:
                return 0
        elif _demo_users(db):
            print(
                "Demo data already exists. Use --reset to recreate it.", file=sys.stderr
            )
            return 1
        print("Creating the six story customers…", flush=True)
        create(db)
        if args.customers > 0:
            staff = user_service.get_user_by_email(db, STAFF_EMAIL)
            print(
                f"Adding {args.customers} customers with a year of history…", flush=True
            )
            done = [0]

            def tick() -> None:
                done[0] += 1
                if done[0] % 10 == 0 or done[0] == args.customers:
                    print(f"  {done[0]}/{args.customers} customers", flush=True)

            create_bulk(
                db,
                staff,
                args.customers,
                domain=DEMO_DOMAIN,
                password=CUSTOMER_PASSWORD,
                progress=tick,
            )
            print("  Billing and payments done.", flush=True)

    print("Demo data created.")
    print(f"  Staff:     {STAFF_EMAIL} / {STAFF_PASSWORD}")
    print(f"  Customers: aarav, priya, rohan, neha, kabir, ananya, new @{DEMO_DOMAIN}")
    print(
        f"             plus {args.customers} more; all use password {CUSTOMER_PASSWORD}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
