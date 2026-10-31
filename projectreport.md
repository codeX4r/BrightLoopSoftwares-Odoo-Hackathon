# Project report: Subscription Management System

Last updated: 31 Oct 2026, night (IST)
Team: Sahil (staff panel, billing, customer backend), Parth (customer portal pages, change
password), Adarsh (auth, admin panel).
Branch: today's work is on `adarsh`, merged with the latest `main` (landing page and new app
design).
Email features and deployment are left out on purpose; they come later.

---

## 1. Summary

The system covers the whole subscription cycle for three roles: admin, staff and customer.

1. The admin sets up products, plans, taxes and discounts.
2. Staff build a quotation from that catalog and send it.
3. The customer accepts or declines it in the portal.
4. Staff activate the subscription.
5. Invoices are generated on each billing date, with the discount and tax applied.
6. Staff record payments until each invoice is paid.

| Measure | Value |
|---|---|
| Backend API endpoints | 99 |
| Frontend screens (`page.tsx`) | 41 |
| Backend tests | 312 pass (198 test functions, some run with several inputs) |
| Tests on real Postgres | 312 pass, including the 2 that are skipped on SQLite |
| Database migration head | `97f2c66310f4` (today's work needs no new migration) |
| Frontend checks | `tsc`, `eslint` and `next build` pass with no errors |

---

## 2. Features that are done

### 2.1 Accounts and security
- Sign in for admin, staff and customer. The login form asks for the role, and the server
  checks it against the account.
- Customers can sign up themselves. Admins create staff accounts.
- Sessions are stored on the server (`auth_sessions` table). The browser gets an HttpOnly
  cookie, and a Bearer token also works for API clients.
- Passwords are hashed with Argon2id. A login with an unknown email takes as long as a
  real check, so attackers can't find out which emails exist from response times.
- Too many failed logins are blocked per email and per IP. The limiter keeps its counts
  in memory.
- Cookie-authenticated writes need the `X-Requested-With` header (CSRF protection).
- Every route checks the role stored in the database. Customers only ever see their own
  records.
- Staff and customers can change their password. This signs out their other sessions.
- Forgot password: the backend is done. Links are single-use, expire after 30 minutes and
  are rate limited. There is no page for it yet (it needs email).

### 2.2 Admin panel (`/admin`)
- Dashboard with customer, billing and catalog figures.
- Product types.
- Products with sales and cost price, and variants with an extra price on top of the product
  price. Products can be archived.
- Subscription plans with:
  - price and billing frequency (daily, weekly, monthly or yearly)
  - minimum quantity
  - the dates when the plan can be offered
  - which products the plan includes
  - rules for pausing, renewing, closing early and closing automatically at expiry
- Taxes. Each tax applies to chosen products or product types, and one tax can be the
  default. The tax for a line is found in this order: product, then product type, then the
  default. Taxes are deactivated, never deleted.
- Discounts:
  - fixed amount or percentage
  - minimum purchase amount or quantity
  - start and end dates
  - usage limit, which holds even when several invoices are confirmed at once
  - a preview of how a discount would apply
- Reports: invoiced, received, outstanding and overdue amounts, plus subscription counts,
  for any date range.
- Settings: company name, address, email and phone, and the invoice number prefix.
  Currency and time zone are fixed to INR and India time for now.
- Customer and staff lists, with details, editing, and activating or deactivating accounts.
- Admins can open the staff screens (quotations, subscriptions, templates, invoices,
  payments) and keep the admin sidebar there.

### 2.3 Staff panel (`/staff`)
- Dashboard: customers, active subscriptions, money received, outstanding and overdue
  amounts, quotations waiting for an answer, recent activity, and a "Generate due invoices"
  button.
- Customers: add, search, edit, and a full history for each customer.
- Quotations and subscriptions go Draft → Quotation → Confirmed → Active → Closed. Staff can
  move a quotation back to draft, mark it as accepted, activate, pause, resume, renew and
  close it. Pause and renew follow the plan's rules.
- **Quotation form (new today):**
  - pick an admin plan from a dropdown; the plan line is added at the plan's minimum quantity
  - add products, and pick a variant where the product has them
  - prices and tax fill in automatically and can still be changed on each line
  - custom lines can still be typed by hand
  - a tax dropdown lists the admin's taxes
  - quotation validity (days) can be set
- **Quotation templates (new today):** list, create, edit, deactivate and delete. Staff can
  start a new quotation from a template, or save any quotation as a template.
- Invoices are generated automatically:
  - one invoice per billing period, never two for the same period
  - missed billing days are caught up on the next run
  - paused subscriptions are skipped
  - billing stops at the expiry date
  - plans set to close at expiry close after the last invoice
- Invoices go Draft → Confirmed → Paid, and can be cancelled while unpaid. The best eligible
  discount comes off before tax. "Send" only records that the invoice was sent; no email
  goes out.
- Payments: full or partial, with the method, date and a transaction ID. The invoice is
  marked paid when the payments reach its total.
- Quotations and invoices can be printed or saved as PDF.

### 2.4 Customer portal (`/portal`)
- Overview of subscriptions, quotations to review, the balance due and overdue amounts.
- Accept a quotation, or decline it with a reason. A quotation can't be accepted after it
  expires, but it can still be declined.
- Pause, resume, renew or close a subscription early, when the plan allows it.
- Invoice list with filters, invoice details, and print or save as PDF.
- Profile (name, company, phone, address) and password change.

### 2.5 Shared across all areas (new today)
- **One layout:** admin, staff and customer screens share one app shell
  (`components/app/app-shell.tsx`, from `main`). It has a grouped sidebar with icons, an
  account menu with log out, and a drawer on phones. It is hidden when printing. Admins keep
  their sidebar on the staff screens. Quotation templates are in the admin and staff
  sidebars.
- **Landing page** at `/`, and a new design for sign-in and sign-up (from `main`).
- **Company details on documents:** printed quotations and invoices (staff and customer)
  show the company name, address, phone and email from the admin settings. They no longer
  always say "Brightloop Software". The new `GET /api/company` endpoint gives every
  signed-in user read access; only the admin can change the details.

---

## 3. Today's work on the old "remaining work" list

| # | Item | Status |
|---|---|---|
| 1 | Plan and product dropdowns in the quotation form | Done |
| 2 | Screens for quotation templates | Done |
| 3 | Company details from settings on printed documents | Done |
| 4 | Admin sidebar sometimes loses its dark style in development | The production build styles it correctly. Your running dev server still needs one restart with `frontend/.next` deleted (not done, because the server is yours) |
| 5 | One layout and one set of components for all roles | Done. My version was replaced by the app shell from `main` when the branches were merged |
| 6 | Test every screen in a browser | Partly done, see section 4 |
| 7 | Run the 2 skipped tests on a real Postgres database | Done: 312 of 312 pass on a throwaway local Postgres database (not Neon) |
| 8–10 | Neon password, demo passwords, remove demo data | Not done. These are for you to do; see section 5 |

Smaller changes made along the way:
- The `Subscription` types in the frontend now include `plan_id`,
  `quotation_validity_days` and each line's product and variant.
- The "Send quotation" step now defaults to the quotation's own validity, not a fixed 15
  days.
- A "Quotation templates" link was added to the admin and staff sidebars.
- The new quotation form, template form and company details block still use the plain grey
  colours (`zinc`). They work, but they don't match `main`'s new colours yet.

---

## 4. What was checked, and what wasn't

All browser checks ran in headless Chrome against a local copy of the database on ports
8010 and 3010. The shared Neon database and your servers on 8000 and 3000 were not touched.

**Checked:**
- 48 screens across all three roles (admin, staff, and three customers), including detail
  pages. None had a script error, a failed API call or a page stuck loading.
- The quotation flow in the browser. These steps all passed:
  1. Build a quotation from a plan, a product variant and a custom line. The saved prices,
     taxes and total were correct (₹1,33,610.00).
  2. Save it as a template.
  3. Use the template for a new quotation. Every field was filled in correctly.
  4. Edit it to a custom plan. The plan was detached.
  5. Edit another draft without changing its plan. The plan was kept.
  6. Print the quotation. The company name, address and phone from the settings showed.
  7. Send the quotation.
- The customer accepted the quotation in the portal.

**Not checked in the browser:** the test stopped at "Activate subscription" because
testing was stopped. These steps have not been clicked through yet: activating after the
customer accepts, generating the invoice from the dashboard, printing an invoice with the
company details, editing a template, and the admin sidebar on staff screens. The backend
for activation, billing and invoices is covered by the automated tests.

---

## 5. Still open

### Before the demo
1. Restart your frontend dev server once, with `frontend/.next` deleted (item 4).
2. Click through, by hand: activate a quotation, generate its invoice, and print it.
3. Restyle the quotation form, template form and company details block in `main`'s new
   colours.

### Before going live (not needed for the demo)
4. The Neon password was shared in chat. Change it in the Neon console and update
   `backend/.env`.
5. The demo passwords in `readme.md` are public. Use different passwords on any real
   database.
6. Remove the demo data with `uv run python -m app.jobs.demo_data --remove`. This deletes
   it for good.
7. The login rate limiter keeps its counts in memory. With more than one server process,
   move it to a shared store such as Redis.

### Left out on purpose
- Email: the forgot password page, emailing invoices and quotations, and reminders.
- Deployment.
- Currencies other than INR and time zones other than India time.

---

## 6. Demo data and logins (Neon)

The Neon database has 49 customers, 40 active subscriptions, 9 open quotations, 111
payments, 4 products, 3 plans, 1 tax (GST 5%, the default) and 1 discount (10% off orders
of ₹50,000 or more). It has no quotation templates yet.

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

If someone changes a demo password in the browser, it changes for everyone.

---

## 7. How to run it

```bash
# Backend (http://localhost:8000)
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# Frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

Invoices are generated with the "Generate due invoices" button on the staff dashboard, or
with `uv run python -m app.jobs.billing`.

Run the tests on SQLite with `uv run pytest`. To run them on Postgres, use a database you
can throw away, because the tests drop its tables:

```bash
createdb brightloop_test
TEST_DATABASE_URL=postgresql+psycopg://localhost/brightloop_test uv run pytest
```

---

## 8. Today's changes (on branch `adarsh`)

Backend:
- `app/api/routes/company.py` (new): `GET /api/company`.
- `app/api/__init__.py`: registers the new route.

Frontend, new files:
- `components/company-details.tsx` and `lib/company.ts`: company details on documents.
- `components/staff/quotation-fields.tsx`: the plan picker and line editor.
- `components/staff/template-form.tsx`: the template form.
- `app/staff/templates/` (list, new and edit pages): the template screens.

Frontend, changed files:
- The quotation form, the new quotation page and the quotation detail page.
- The staff API types, `lib/staff-api.ts`.
- `components/app/nav-config.ts`: the "Quotation templates" links.
- The quotation document and the staff and customer invoice pages.

Two local test databases were created on this machine's Postgres: `brightloop_test` and
`brightloop_smoke`. Nothing uses them, and you can remove them with `dropdb`.
