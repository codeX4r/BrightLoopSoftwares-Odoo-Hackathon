# Project report: Subscription Management System

Last updated: 31 Oct 2026, evening (IST)
Team: Sahil (staff panel, billing, customer backend), Parth (customer portal pages, change
password), Adarsh (auth, admin panel).
Branch: everything is merged into `main`.
Email features and deployment are left out on purpose; they come later.

---

## 1. Where the project stands

The project works end to end for all three roles: admin, staff and customer.

- The admin manages products, variants, plans, taxes, discounts, reports, settings,
  customers and staff.
- Staff create quotations, activate subscriptions, generate invoices and record payments.
- Customers sign up, accept or decline quotations, see their invoices and manage their
  subscriptions.
- Invoices apply the admin's discounts and taxes automatically.
- Subscriptions follow their plan's rules for pausing, renewing and closing.
- 306 backend tests pass, and the frontend builds with no errors.
- The Neon database is up to date (migration `97f2c66310f4`) and has demo data in it.

---

## 2. What works

### Admin (`/admin`)
- Manage products and their variants, with sales and cost prices.
- Manage product types.
- Manage subscription plans: price, billing frequency, minimum quantity, available dates,
  and whether customers may pause, renew or close early.
- Manage taxes and choose which products they apply to.
- Manage discounts: fixed or percentage, minimums, dates and usage limits.
- See revenue and subscription reports.
- Change company settings and the invoice number prefix.
- Add staff, and activate or deactivate customers and staff.
- Open the staff screens for quotations, invoices and payments.

### Staff (`/staff`)
- See a dashboard of customers, revenue, outstanding money, overdue invoices and recent
  activity.
- Add, search and edit customers, and see each customer's full history.
- Create, send and activate quotations. Quotations can use an admin plan, and lines can use
  admin products with their tax filled in automatically.
- Generate invoices automatically, with no duplicates. Missed billing days are caught up.
- Confirm, cancel, print and download invoices. Discounts show on the invoice.
- Record full or part payments with a transaction ID.
- Pause, resume and renew subscriptions when the plan allows it.
- Change their own password.

### Customer (`/portal`)
- Sign up for a customer account.
- See an overview of subscriptions, quotations and money owed.
- Accept or decline a quotation, with a reason.
- See and filter invoices, and print them.
- Pause, resume, renew or close a subscription early when the plan allows it.
- Edit their profile and change their password.

---

## 3. Remaining work

These items are not done yet. Times are rough estimates for one developer.

### Staff panel
1. The quotation form still asks staff to type each line by hand. The backend already
   supports choosing a plan and products, but the form has no dropdowns for them yet.
   (3–4 hours)
2. Quotation templates have a backend but no screen. Staff can't save or reuse a template
   from the browser yet. (1–2 hours)
3. Quotation and invoice PDFs always print "Brightloop Software". They should use the
   company name, address and phone from the admin settings. (30 minutes)

### Admin panel
4. The admin sidebar sometimes shows without its dark style during development. Stop the
   dev server, delete the `frontend/.next` folder, and start it again to fix it. Then check
   it in the browser. (15 minutes)

### All areas
5. The admin, staff and customer screens look different. The admin side uses a dark
   sidebar, while staff and customers use a top bar. They should share one layout and one
   set of buttons, cards and tables. (3–4 hours)
6. Nobody has clicked through every screen in a browser yet. Each role should be tested by
   hand before the demo. (1–2 hours)
7. Two backend tests are skipped because they need a real Postgres database. They should be
   run once against a test database, not the shared Neon one. (30 minutes)

### Before going live (not needed for the demo)
8. The Neon password was shared in chat. Change it in the Neon console and update
   `backend/.env`.
9. The demo passwords in `readme.md` are public. Use different passwords on any real
   database.
10. Remove the demo data with `uv run python -m app.jobs.demo_data --remove`.

**Total remaining: about 9–13 hours.**

### Left out on purpose
- Email: forgot password, sending invoices and quotations, and reminders. The forgot
  password backend exists, but there's no page for it yet.
- Deployment.

---

## 4. Demo data and logins

The database has 49 customers, 40 active subscriptions, 9 open quotations, 111 payments,
4 products, 3 plans, 1 tax (GST 5%, the default) and 1 discount (10% off orders of
₹50,000 or more).

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

## 5. How to run it

```powershell
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
