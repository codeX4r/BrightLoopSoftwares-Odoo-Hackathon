"""Bulk demo history: many customers with a year of subscriptions, invoices and payments.

Used by app.jobs.demo_data. Rows are inserted directly with backdated timestamps so the
dashboards and activity look like a business that has been running for a year. Invoices
are still produced by the real billing service, so periods, totals and the no-duplicate
rule are exactly what production would generate.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.customer_profile import CustomerProfile
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentMethod
from app.models.subscription import (
    BillingFrequency,
    Subscription,
    SubscriptionLine,
    SubscriptionStatus,
)
from app.models.user import User, UserRole
from app.services import billing_service, clock
from app.services.numbering import SUBSCRIPTION_SEQUENCE, next_number

FIRST_NAMES = [
    "Aditya", "Isha", "Vikram", "Sneha", "Arjun", "Meera", "Rahul", "Kavya", "Siddharth",
    "Pooja", "Karan", "Divya", "Manish", "Riya", "Nikhil", "Tanvi", "Harsh", "Shreya",
    "Varun", "Aditi", "Yash", "Nandini", "Amit", "Simran", "Gaurav", "Pallavi", "Rakesh",
    "Anjali", "Saurabh", "Deepika", "Mohit", "Swati", "Ankit", "Ritika", "Vivek", "Komal",
]  # fmt: skip
LAST_NAMES = [
    "Agarwal", "Singh", "Patel", "Reddy", "Nair", "Kapoor", "Joshi", "Malhotra", "Chopra",
    "Bose", "Das", "Kulkarni", "Pandey", "Mishra", "Saxena", "Bhatia", "Menon", "Tiwari",
]  # fmt: skip
COMPANY_PREFIXES = [
    "Apex", "Blue Lotus", "Crescent", "Delta", "Evergreen", "Falcon", "Ganga", "Horizon",
    "Indus", "Kaveri", "Lakshmi", "Metro", "Nova", "Orbit", "Pioneer", "Quantum",
    "Rising Sun", "Sapphire", "Trident", "Unity", "Vertex", "Zenith",
]  # fmt: skip
COMPANY_WORDS = [
    "Infotech", "Solutions", "Retail", "Logistics", "Healthcare", "Foods", "Textiles",
    "Consulting", "Analytics", "Motors", "Pharma", "Studios", "Exports", "Systems",
]  # fmt: skip
CITIES = [
    "Gomti Nagar, Lucknow", "Aliganj, Lucknow", "Hazratganj, Lucknow",
    "Connaught Place, Delhi", "Sector 18, Noida", "Cyber City, Gurugram",
    "Koramangala, Bengaluru", "Baner, Pune", "Salt Lake, Kolkata",
    "Banjara Hills, Hyderabad", "Navrangpura, Ahmedabad", "Civil Lines, Jaipur",
]  # fmt: skip

# (plan, frequency, price per seat, seat range, chance of an add-on), with weights.
PLANS = [
    ("Basic Plan", BillingFrequency.MONTHLY, "999", (1, 8), 0.2),
    ("Professional Plan", BillingFrequency.MONTHLY, "1999", (2, 15), 0.5),
    ("Enterprise Plan", BillingFrequency.MONTHLY, "5000", (5, 25), 0.8),
    ("Enterprise Plan (Yearly)", BillingFrequency.YEARLY, "25000", (1, 4), 0.3),
    ("Starter Weekly", BillingFrequency.WEEKLY, "499", (1, 3), 0.0),
]
PLAN_WEIGHTS = [26, 32, 22, 12, 8]
ADDONS = [
    ("Priority support", "500"),
    ("Extra storage (100 GB)", "300"),
    ("API access", "750"),
]
DECLINE_REASONS = [
    "Budget is approved only from next quarter.",
    "We found a cheaper option for now.",
    "Need fewer seats; please send a revised offer.",
    None,
]
METHODS = [
    PaymentMethod.UPI,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.CARD,
    PaymentMethod.CHEQUE,
    PaymentMethod.CASH,
]
METHOD_WEIGHTS = [34, 36, 14, 6, 10]
OUTCOMES = [
    "active",
    "closed",
    "quotation",
    "expired_quotation",
    "confirmed",
    "declined",
    "draft",
]
OUTCOME_WEIGHTS = [62, 10, 9, 4, 7, 6, 2]


def _at(day: date, rng: random.Random, start: int = 9, end: int = 18) -> datetime:
    """A business-hours timestamp on `day`, India time."""
    moment = time(
        rng.randint(start, end), rng.randint(0, 59), tzinfo=clock.BUSINESS_TIMEZONE
    )
    return datetime.combine(day, moment)


def _reference(method: PaymentMethod, rng: random.Random) -> str | None:
    if method == PaymentMethod.UPI:
        return f"UPI-{rng.randint(10**9, 10**10 - 1)}"
    if method == PaymentMethod.BANK_TRANSFER:
        return f"UTR{rng.randint(10**10, 10**11 - 1)}"
    if method == PaymentMethod.CARD:
        return f"CARD-****{rng.randint(1000, 9999)}"
    if method == PaymentMethod.CHEQUE:
        return f"CHQ {rng.randint(100000, 999999)}"
    return None


def _lines(rng: random.Random, plan) -> list[SubscriptionLine]:
    name, _freq, price, (low, high), addon_chance = plan
    seats = rng.randint(low, high)
    lines = [
        SubscriptionLine(
            position=0,
            description=f"{name} (per seat)" if seats > 1 else name,
            quantity=seats,
            unit_price=Decimal(price),
            tax_rate=Decimal(18),
        )
    ]
    if rng.random() < addon_chance:
        addon, addon_price = rng.choice(ADDONS)
        lines.append(
            SubscriptionLine(
                position=1,
                description=addon,
                quantity=rng.randint(1, 3),
                unit_price=Decimal(addon_price),
                tax_rate=Decimal(18),
            )
        )
    return lines


def _settle(db: Session, sub_id, staff: User, rng: random.Random) -> None:
    """Confirms and pays a generated invoice history the way a real business would:
    older invoices mostly paid on time, a few late or part-paid, recent ones still open."""
    today = clock.today()
    invoices = list(
        db.scalars(
            select(Invoice)
            .where(Invoice.subscription_id == sub_id)
            .order_by(Invoice.period_start)
        )
    )
    for index, invoice in enumerate(invoices):
        invoice.created_at = _at(invoice.invoice_date, rng, 6, 8)
        age = (today - invoice.invoice_date).days
        if index == len(invoices) - 1 and age <= 3 and rng.random() < 0.5:
            continue  # The newest invoice is still a draft for staff to review.
        invoice.status = InvoiceStatus.CONFIRMED
        invoice.confirmed_at = _at(invoice.invoice_date, rng)
        roll = rng.random()
        if age > 45:
            outcome = "full" if roll < 0.9 else ("partial" if roll < 0.96 else "unpaid")
        elif age > 10:
            outcome = (
                "full" if roll < 0.65 else ("partial" if roll < 0.75 else "unpaid")
            )
        else:
            outcome = "full" if roll < 0.35 else "unpaid"
        if rng.random() < 0.8:
            invoice.sent_at = invoice.confirmed_at
        if invoice.total == 0 or outcome == "unpaid":
            continue

        terms = max(1, (invoice.due_date - invoice.invoice_date).days)
        late = rng.random() < 0.15
        paid_on = invoice.invoice_date + timedelta(
            days=rng.randint(terms + 1, terms + 20) if late else rng.randint(0, terms)
        )
        paid_on = min(paid_on, today)
        amount = invoice.total
        if outcome == "partial":
            share = Decimal(rng.choice(["0.3", "0.4", "0.5", "0.6"]))
            amount = (invoice.total * share).quantize(Decimal("0.01"))
        method = rng.choices(METHODS, weights=METHOD_WEIGHTS)[0]
        db.add(
            Payment(
                invoice_id=invoice.id,
                amount=amount,
                method=method,
                paid_on=paid_on,
                reference=_reference(method, rng),
                recorded_by_id=staff.id,
                created_at=_at(paid_on, rng),
            )
        )
        invoice.amount_paid = amount
        if amount == invoice.total:
            invoice.status = InvoiceStatus.PAID
            invoice.paid_at = _at(paid_on, rng)
    db.commit()


def create_bulk(
    db: Session,
    staff: User,
    count: int,
    *,
    domain: str,
    password: str,
    seed: int = 2026,
    progress=None,
) -> None:
    """Adds `count` customers with backdated history. Same seed, same data."""
    rng = random.Random(seed)
    today = clock.today()
    password_hash = hash_password(password)
    used: set[str] = set()
    to_bill: list[tuple] = []  # (subscription id, close-on date or None)

    for _ in range(count):
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        local = f"{first}.{last}".lower()
        while local in used:
            local = f"{first}.{last}{rng.randint(2, 99)}".lower()
        used.add(local)
        joined = today - timedelta(days=rng.randint(20, 360))
        active_account = rng.random() > 0.05
        user = User(
            email=f"{local}@{domain}",
            password_hash=password_hash,
            role=UserRole.CUSTOMER,
            is_active=active_account,
            created_at=_at(joined, rng),
        )
        db.add(user)
        db.flush()
        # A few self-registered customers never filled in their profile.
        if rng.random() < 0.9:
            company = None
            if rng.random() < 0.8:
                company = f"{rng.choice(COMPANY_PREFIXES)} {rng.choice(COMPANY_WORDS)}"
            phone = None
            if rng.random() < 0.85:
                phone = f"+91 9{rng.randint(10**8, 10**9 - 1)}"
            db.add(
                CustomerProfile(
                    user_id=user.id,
                    full_name=f"{first} {last}",
                    company_name=company,
                    phone=phone,
                    address=rng.choice(CITIES) if rng.random() < 0.75 else None,
                    created_at=_at(joined, rng),
                )
            )

        how_many = (
            rng.choices([1, 2, 3], weights=[70, 25, 5])[0] if active_account else 1
        )
        for _ in range(how_many):
            outcome = rng.choices(OUTCOMES, weights=OUTCOME_WEIGHTS)[0]
            if not active_account:
                outcome = "closed"
            plan = rng.choices(PLANS, weights=PLAN_WEIGHTS)[0]
            frequency = plan[1]
            # Weekly plans start recently so they don't produce dozens of invoices.
            oldest = (
                70 if frequency == BillingFrequency.WEEKLY else (today - joined).days
            )
            created = today - timedelta(days=rng.randint(2, max(3, oldest)))
            sub = Subscription(
                number=next_number(db, SUBSCRIPTION_SEQUENCE),
                customer_id=user.id,
                status=SubscriptionStatus.DRAFT,
                plan_name=plan[0],
                billing_frequency=frequency,
                payment_terms_days=rng.choice([0, 7, 15, 15, 30]),
                created_by_id=staff.id,
                lines=_lines(rng, plan),
                created_at=_at(created, rng),
            )
            db.add(sub)
            if outcome == "draft":
                continue

            sent = created + timedelta(days=rng.randint(0, 2))
            if outcome == "quotation":
                sent = today - timedelta(days=rng.randint(0, 10))  # still valid
                sub.created_at = _at(sent, rng)
            sent = min(sent, today)
            sub.status = SubscriptionStatus.QUOTATION
            sub.quotation_sent_at = _at(sent, rng)
            sub.quotation_valid_until = sent + timedelta(days=15)
            if outcome == "quotation":
                continue
            if outcome == "expired_quotation":
                sub.quotation_valid_until = min(
                    sub.quotation_valid_until, today - timedelta(days=1)
                )
                continue
            if outcome == "declined":
                declined = min(sent + timedelta(days=rng.randint(1, 6)), today)
                sub.status = SubscriptionStatus.CLOSED
                sub.rejected_at = _at(declined, rng)
                sub.rejection_reason = rng.choice(DECLINE_REASONS)
                sub.closed_at = sub.rejected_at
                continue

            accepted = min(sent + timedelta(days=rng.randint(0, 5)), today)
            sub.status = SubscriptionStatus.CONFIRMED
            sub.confirmed_at = _at(accepted, rng)
            if outcome == "confirmed":
                continue

            start = min(accepted + timedelta(days=rng.randint(0, 4)), today)
            sub.status = SubscriptionStatus.ACTIVE
            sub.start_date = start
            sub.next_billing_date = start
            sub.activated_at = _at(start, rng)
            close_on = None
            if outcome == "closed":
                expiry = billing_service.add_months(start, rng.randint(2, 6), start.day)
                sub.expiry_date = min(expiry, today)
                close_on = sub.expiry_date
            db.flush()
            to_bill.append((sub.id, close_on))
        db.commit()
        if progress:
            progress()

    for sub_id, close_on in to_bill:
        billing_service.bill_subscription(db, sub_id, today)
        _settle(db, sub_id, staff, rng)
        if close_on is not None:
            sub = db.scalar(
                select(Subscription)
                .options(selectinload(Subscription.lines))
                .where(Subscription.id == sub_id)
            )
            sub.status = SubscriptionStatus.CLOSED
            sub.next_billing_date = None
            sub.closed_at = _at(close_on, rng)
            db.commit()
