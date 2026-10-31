"""Admin views of customer and staff accounts. Never includes password hashes."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr

from app.models.payment import Payment, PaymentMethod
from app.models.profiles import CustomerProfile, StaffProfile
from app.models.user import User, UserRole
from app.services.people_service import CustomerFigures, StaffFigures


class CustomerFiguresRead(BaseModel):
    subscriptions_total: int
    active_subscriptions: int
    # Confirmed or paid invoices only: drafts are internal and cancelled ones are void.
    invoices_total: int
    invoiced_amount: Decimal
    paid_amount: Decimal
    outstanding_amount: Decimal
    overdue_invoices: int


class StaffFiguresRead(BaseModel):
    subscriptions_created: int
    payments_recorded: int
    payments_amount: Decimal


class AccountRead(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CustomerRow(AccountRead):
    figures: CustomerFiguresRead
    # From the customer profile; None when no profile has been filled in.
    full_name: str | None = None
    company_name: str | None = None


class StaffRow(AccountRead):
    figures: StaffFiguresRead
    full_name: str | None = None
    phone: str | None = None


class PaymentBrief(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    customer_email: EmailStr
    amount: Decimal
    method: PaymentMethod
    paid_on: date


class CustomerDetailRead(CustomerRow):
    recent_payments: list[PaymentBrief]


class StaffDetailRead(StaffRow):
    recent_payments: list[PaymentBrief]


def _account(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


def customer_row(
    user: User, figures: CustomerFigures, profile: CustomerProfile | None = None
) -> CustomerRow:
    return CustomerRow(
        **_account(user),
        figures=CustomerFiguresRead(**figures.__dict__),
        full_name=profile.full_name if profile else None,
        company_name=profile.company_name if profile else None,
    )


def staff_row(
    user: User, figures: StaffFigures, profile: StaffProfile | None = None
) -> StaffRow:
    return StaffRow(
        **_account(user),
        figures=StaffFiguresRead(**figures.__dict__),
        full_name=profile.full_name if profile else None,
        phone=profile.phone if profile else None,
    )


def payment_brief(payment: Payment) -> PaymentBrief:
    return PaymentBrief(
        id=payment.id,
        invoice_id=payment.invoice_id,
        invoice_number=payment.invoice.number,
        customer_email=payment.invoice.customer.email,
        amount=payment.amount,
        method=payment.method,
        paid_on=payment.paid_on,
    )
