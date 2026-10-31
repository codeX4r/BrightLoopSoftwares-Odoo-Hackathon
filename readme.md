# Subscription Management System

A centralized subscription management and billing platform designed to help businesses manage customers, products, subscription plans, quotations, recurring invoices, taxes, discounts and payments through a unified system.

## 1. Overview

The Subscription Management System aims to simplify and automate the subscription lifecycle for businesses.

Businesses often rely on spreadsheets and manual processes to manage subscriptions, track renewals, generate invoices and monitor payments. These processes become difficult to maintain as the number of customers and subscriptions increases.

This system provides a centralized platform to automate these operations, reduce manual errors and improve financial visibility.

## 2. Problem Statement

Businesses managing subscription-based services face several operational challenges:

- Manual tracking of customer subscriptions and renewals.
- Difficulty managing multiple products, variants and pricing plans.
- Time-consuming quotation and invoice generation.
- Errors in tax and discount calculations.
- Difficulty tracking payments and outstanding invoices.
- Lack of centralized financial reporting.
- Performance issues when managing thousands of subscriptions.

The proposed system addresses these challenges through an integrated subscription and billing management platform.

## 3. Objectives

- Centralize customer and subscription management.
- Automate recurring invoice generation.
- Simplify product, variant and subscription plan management.
- Provide configurable tax and discount rules.
- Track payments and outstanding invoices.
- Implement role-based access control.
- Provide financial dashboards and reports.
- Maintain efficient performance with thousands of subscriptions.

## 4. Core Features

### 4.1 Authentication & User Management
- Customer registration and login.
- Secure password management.
- Forgot password and password reset.
- Role-based access control (RBAC).
- Three user roles:
  - Admin
  - Staff
  - Customer
- Only administrators can create staff accounts.

### 4.2 Product Management
- Create, update and manage products.
- Configure product types.
- Manage sales price and cost price.
- Add product descriptions and notes.
- Create and manage product variants.
- Configure additional pricing for variants.

### 4.3 Subscription Plan Management
- Create and manage subscription plans.
- Configure plan pricing.
- Support daily, weekly, monthly and yearly billing frequencies.
- Configure minimum quantities.
- Define plan availability periods.
- Configure automatic closure after expiry.
- Support subscription pause, renewal and early closure according to plan rules.

### 4.4 Quotation Management
- Create reusable quotation templates.
- Generate quotations for customers.
- Add products, quantities and pricing.
- Configure quotation validity.
- Track quotation status.
- Convert confirmed quotations into subscriptions.

### 4.5 Subscription Management
- Generate unique subscription numbers.
- Manage subscription details and line items.
- Track subscription start and expiry dates.
- Manage payment terms.
- Track subscription lifecycle:

  `Draft → Quotation → Confirmed → Active → Closed`

- Manage subscription renewals and closures.

### 4.6 Invoice Management
- Automatically generate invoices from subscriptions.
- Prevent duplicate invoices for the same billing cycle.
- Generate invoices containing customer and product details.
- Calculate applicable taxes and discounts.
- Support invoice confirmation and cancellation.
- Provide invoice viewing, sending and printing functionality.

### 4.7 Tax Management
- Configure tax rules.
- Apply taxes to relevant products and subscriptions.
- Automatically calculate tax amounts.
- Include tax breakdowns in invoices.

### 4.8 Discount Management
- Configure fixed-amount discounts.
- Configure percentage-based discounts.
- Define minimum purchase amounts.
- Define minimum quantity requirements.
- Configure discount validity periods.
- Set maximum usage limits.
- Apply discounts to selected products or entire subscriptions.

### 4.9 Payment Management
- Record customer payments.
- Track payment methods and dates.
- Associate payments with invoices.
- Maintain payment records and notes.
- Track paid and outstanding amounts.

### 4.10 Dashboard & Reporting
- View active subscription counts.
- Monitor revenue.
- Track received payments.
- Monitor outstanding invoices.
- Identify overdue invoices.
- Filter and analyze financial information.

## 5. User Roles

| Role | Responsibilities |
|---|---|
| Admin | Full system access, user management, products, plans, taxes, discounts and reporting |
| Staff | Customer management, quotations, subscriptions, invoices and payment operations |
| Customer | Access personal account, subscriptions and invoices |

## 6. Subscription Workflow

The overall business workflow follows these steps:

1. Customer registers on the platform.
2. Admin configures products, variants, plans and pricing.
3. Staff creates a quotation for the customer.
4. Customer reviews and confirms the quotation.
5. The subscription becomes active.
6. The system generates invoices according to the billing schedule.
7. Customer payments are recorded against invoices.
8. Admin and staff monitor business performance through dashboards.

## 7. Performance Requirements

The system should be designed to:

- Handle thousands of subscription records.
- Maintain efficient database queries.
- Prevent duplicate invoice generation.
- Ensure accurate billing calculations.
- Deliver page response times under 2 seconds, including when handling thousands of subscriptions.

## 8. Project Scope

The project focuses on building an integrated business application covering:

- Customer management.
- Product and pricing management.
- Subscription lifecycle management.
- Quotation management.
- Recurring billing.
- Invoice generation.
- Tax and discount calculations.
- Payment tracking.
- Financial reporting.

## 9. Future Enhancements

Potential extensions beyond the stated requirements include:

- Payment gateway integration.
- Automated payment collection.
- Email and renewal notifications.
- Advanced revenue analytics.
- Subscription usage analytics.
- Automated payment reconciliation.
- Customer self-service subscription management.

These features are potential future extensions and are not assumed to be part of the initial requirements.

## 10. Getting Started

See `backend/README.md` for backend details.

```bash
# Backend (http://localhost:8000)
cd backend
uv sync
cp .env.example .env          # set DATABASE_URL
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# Frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

### Demo Login Accounts (development only)

Sign in at http://localhost:3000/login, choose the matching role in **Login as**, and enter the email and password.

| Login as | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@brightloop.com` | `Admin@123456` | `/admin` |
| Staff | `staff@brightloop.com` | `Staff@Brightloop2026` | `/staff` |
| Customer | `customer@brightloop.com` | `Customer@Brightloop2026` | `/portal` |

The staff and customer accounts are created by the Alembic migration `a7c2e9d41b03_seed_demo_staff_and_customer`, so `uv run alembic upgrade head` creates them on any new database. Running it again does not duplicate or overwrite them.

The admin account is seeded from an environment variable, so its password never goes in the repo. On a new database, run from `backend/`:

```bash
SEED_ADMIN_PASSWORD='choose-a-12+-char-password' uv run alembic upgrade head
```

Optional: set `SEED_ADMIN_EMAIL` (default `admin@brightloop.com`). Without `SEED_ADMIN_PASSWORD`, the migration skips the admin. You can also create an admin with `uv run python -m app.cli create-admin --email admin@brightloop.com`.

> **Warning:** These credentials are public. Use them only on local or demo databases, never in production.

## 11. Project Status

**Status:** Planning / Development

The project is based on the Subscription Management System business requirements provided by Brightloop Software.

---

**Subscription Management System**  
*Simplifying subscriptions. Automating billing. Improving business operations.*