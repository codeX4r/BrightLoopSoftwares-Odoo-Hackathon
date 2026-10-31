# Subscription Management System

A centralized subscription management and billing platform designed to help businesses manage customers, products, subscription plans, quotations, recurring invoices, taxes, discounts, and payments through a unified system.

## Demo Login Credentials

Open `http://localhost:3000/login` and sign in using one of the following accounts.

| Login | Password | Shows |
|---|---|---|
| `admin@brightloop.com` | `Admin@123456` | Admin panel |
| `staff@demo.brightloop.com` | `Staff@Demo2026` | Staff panel with all the data |
| `aarav@demo.brightloop.com` | `Customer@Demo2026` | Paid, part-paid and overdue invoices |
| `priya@demo.brightloop.com` | `Customer@Demo2026` | An open quotation to accept or decline |
| `rohan@demo.brightloop.com` | `Customer@Demo2026` | Accepted, waiting for staff to activate |
| `neha@demo.brightloop.com` | `Customer@Demo2026` | A declined quotation with a reason |
| `kabir@demo.brightloop.com` | `Customer@Demo2026` | A weekly plan with a fresh draft invoice |
| `ananya@demo.brightloop.com` | `Customer@Demo2026` | A finished subscription |
| `new@demo.brightloop.com` | `Customer@Demo2026` | A new customer with nothing yet |

> **Warning:** These are public demo credentials. Use them only in local or demo environments, never in production.

## 1. Overview

The Subscription Management System simplifies the subscription lifecycle by bringing customer management, quotations, subscriptions, recurring billing, invoices, and payments into one centralized application.

It helps reduce manual work, organize business operations, and improve financial visibility.

## 2. Core Features

- **Authentication & Roles:** Secure login, registration, password management, and role-based access for Admin, Staff, and Customers.
- **Product & Plan Management:** Manage products, variants, pricing, and subscription plans.
- **Customer Management:** Create, search, update, and manage customer records.
- **Quotation Management:** Generate quotations and allow customers to accept or decline them.
- **Subscription Management:** Activate, pause, resume, renew, and close subscriptions.
- **Invoice & Billing:** Generate recurring invoices, prevent duplicate billing, and calculate taxes and discounts.
- **Payment Management:** Record full and partial payments and track outstanding balances.
- **Dashboard & Reports:** Monitor revenue, subscriptions, payments, overdue invoices, and business activity.
- **Customer Portal:** Let customers view their profile, quotations, subscriptions, and invoices.

## 3. User Roles

| Role | Responsibilities |
|---|---|
| Admin | Manage products, plans, staff, customers, taxes, discounts, settings, and reports. |
| Staff | Manage customers, quotations, subscriptions, invoices, and payments. |
| Customer | View personal information, respond to quotations, and manage available subscription actions. |

## 4. Project Workflow

1. Admin configures products, variants, subscription plans, and pricing.
2. Staff creates a quotation for a customer.
3. Customer reviews and accepts or declines the quotation.
4. Staff activates the subscription after confirmation.
5. The billing job generates invoices for due billing periods.
6. Staff records full or partial customer payments.
7. Admin and staff monitor business activity through dashboards.
8. Customers access their subscriptions and invoices through the customer portal.

## 5. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Authentication | Argon2 password hashing, database-backed sessions |

## 6. Project Structure

```text
BrightLoopSoftwares-Odoo-Hackathon/
│
├── backend/
│   ├── app/
│   │   ├── api/          # API routes and dependencies
│   │   ├── core/         # Configuration, security, email, rate limits
│   │   ├── db/           # Database setup
│   │   ├── jobs/         # Billing and demo-data jobs
│   │   ├── models/       # Database models
│   │   ├── schemas/      # Request and response schemas
│   │   └── services/     # Business logic
│   │
│   ├── alembic/          # Database migrations
│   └── tests/            # Backend tests
│
├── frontend/
│   └── src/
│       ├── app/          # Admin, staff, portal, login, signup
│       ├── components/   # Reusable UI components
│       └── lib/          # API clients and utilities
│
├── projectreport.md
└── readme.md
```

## 7. Getting Started

### Prerequisites

- Python 3.13
- Node.js and npm
- PostgreSQL
- uv package manager

### Backend Setup

```bash
cd backend

# Install dependencies
uv sync

# Create environment configuration
cp .env.example .env
```

Configure `DATABASE_URL` in `backend/.env`.

Run database migrations:

```bash
uv run alembic upgrade head
```

Create demo staff and customer accounts with sample business data:

```bash
uv run python -m app.jobs.demo_data
```

Create the admin account on a new database:

```bash
SEED_ADMIN_PASSWORD='choose-a-private-password-of-at-least-12-characters' uv run alembic upgrade head
```

Optional: Set `SEED_ADMIN_EMAIL` (default: `admin@brightloop.com`).

Alternatively, create an admin using:

```bash
uv run python -m app.cli create-admin --email admin@brightloop.com
```

Start the backend server:

```bash
uv run uvicorn app.main:app --reload
```

Backend URLs:

- API: `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### Frontend Setup

Open another terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend: `http://localhost:3000`

## 8. Recurring Billing

The backend includes a billing job that generates invoices for subscriptions due for billing.

Run from the `backend/` directory:

```bash
uv run python -m app.jobs.billing
```

To run billing for a specific date:

```bash
uv run python -m app.jobs.billing --as-of YYYY-MM-DD
```

The billing job avoids generating duplicate invoices for an already-billed period.

## 9. Testing

### Backend

```bash
cd backend

uv run pytest
uv run ruff check .
```

### Frontend

```bash
cd frontend

npm run lint
npm run build
```
