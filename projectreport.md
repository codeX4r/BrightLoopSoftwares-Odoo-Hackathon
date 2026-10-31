# Project report: Staff panel and Customer portal

Last updated: 2026-10-31, afternoon (IST)
Owners: Sahil (staff panel and its backend), Parth (customer portal pages)
Working branch: `sahil/staff` (includes `main`, customer signup and Parth's portal)

**In one line:** the full customer journey works end to end. A customer signs up, staff send
a quotation, the customer accepts or declines it, staff activate it, invoices are generated
automatically, and payments are recorded. What's left mostly waits on the **admin** section
(products, plans, taxes, discounts).

---

## 1. Status at a glance

| Area | Status |
|---|---|
| Staff panel | ✅ Working. Every screen is built and tested |
| Customer portal | ✅ Working. Every screen is built and tested |
| Tests | ✅ 78 backend tests pass, 41 live checks pass, frontend builds with no errors |
| Demo data | ✅ Loaded in Neon (49 customers, most with a year of history) |
| Pushed to GitHub | ⚠️ **Not yet.** Today's work is on Sahil's machine only (see section 6) |
| Waiting on admin | ⛔ Products, plans, taxes, discounts (see section 4) |

---

## 2. Staff panel: what works (`/staff`)

| Screen | What staff can do |
|---|---|
| Dashboard | See total customers, active subscriptions, open quotations, money received, money still owed, overdue invoices and recent activity. Filter revenue by date. |
| Customers | Search by name, company, email or phone. Add a customer with a login. Edit name, company, phone and address. See each customer's subscriptions, invoices and payments with totals. |
| Quotations & subscriptions | Create a quotation, edit it while it's a draft, send it with a validity period (default 15 days), mark it accepted, activate it with a start date, close it. Download the quotation as a PDF. See when a customer **declined** and why. |
| Invoices | Generated automatically on each billing date (daily, weekly, monthly or yearly). Confirm, cancel, mark as sent, print or save as PDF. See paid, unpaid and overdue at a glance. |
| Payments | Record a payment with method, date and transaction ID. Part payments are allowed; the invoice turns **Paid** when fully settled. See all payments with filters. |

**Rules the system enforces:**
- An invoice is never created twice for the same billing period. Running billing again is safe.
- Missed billing days are caught up automatically, and billing stops at the expiry date.
- A payment can't be larger than what's owed or dated in the future.
- An invoice that has payments can't be cancelled.
- An expired quotation can't be accepted.
- Only drafts can be edited.

## 3. Customer portal: what works (`/portal`)

| Screen | What customers can do |
|---|---|
| Sign up (`/signup`) | Create their own account (customers only; staff and admin are created by an admin). Password must be over 8 characters with uppercase, lowercase and a special character. |
| Overview | See active subscriptions, quotations waiting for them, balance due and overdue amount. New customers see a short "how it works". |
| My subscriptions | View quotations and subscriptions with all lines and totals. **Accept** or **decline** a quotation (with an optional reason staff will see). |
| My invoices | View all invoices with paid and due amounts. Filter: all, unpaid, overdue, paid, cancelled. Open and print any invoice. |
| My profile | Add or edit name, company, phone and address. Staff see these details straight away. |

**Privacy:** customers only ever see their own records. Drafts are hidden from them, and
another customer's quotation or invoice returns "not found".

---

## 4. What's left: waiting on the ADMIN section

These can't be finished until the admin developer pushes their tables. Until then staff
type the details on each quotation line by hand, and everything else works.

| Staff / customer feature | What it needs from admin | Today's workaround |
|---|---|---|
| Pick a product and variant on a quotation | `products` and `product_variants` tables | Staff type the product name and price |
| Pick a subscription plan | `subscription_plans` (price, billing frequency) | Staff type the plan name and choose the frequency |
| Taxes worked out automatically | `taxes` table and how a tax links to a product | Staff type the tax % on each line (default 18%) |
| Discounts on quotations and invoices | `discounts` table (fixed or %, minimums, dates, usage limit) | Not available |
| Minimum quantity check | `min_quantity` on the plan | Not checked |
| Customer pauses, renews or closes early | Plan rules: can pause, can renew, can close early | Staff close subscriptions manually |
| Auto-close a subscription after expiry | Plan rule: auto-close | Billing stops at expiry, but the status stays Active until staff close it |
| Quotation templates | Products and plans, so templates can reuse them | Not started; best built once the admin tables exist |

**Agree with the admin developer before they write their migrations:**
1. The table and column names above, with UUID ids. Quotation and invoice lines will point to them.
2. Is the discount applied before tax? The brief assumes yes.
3. Who counts discount uses? We suggest counting when an invoice is confirmed, so it isn't counted twice.
4. Can one product have more than one tax?

**When the admin code is pushed:** pull it into `sahil/staff`. If both sides added a
migration, run `uv run alembic merge heads` once, then `uv run alembic upgrade head`. Then
we add the product, plan, tax and discount pickers to the quotation form and link the lines
with a small migration. Prices will still be copied onto each line, so changing a price
later never changes old quotations or invoices.

## 5. What's left: NOT dependent on admin

| Item | Status | Notes |
|---|---|---|
| Forgot password by email | ⏸ Paused on purpose | Needs an email service and the auth owner (Adarsh) |
| Change password while signed in | Not started | Auth area |
| Emailing invoices and quotations | Partly done | "Mark as sent" plus print/PDF work; real sending needs an email service |
| Billing runs every day on its own | Ready, not scheduled | The job exists (`uv run python -m app.jobs.billing`); schedule it as a daily cron job when deploying, for example on Render. Until then use "Generate due invoices" on the dashboard. |
| Limit on sign-ups per person | Not started | Low priority for the demo |

**Decided:** only an admin can deactivate or reactivate a customer. Staff can't, and that's
intended. The backend for it already exists (`PATCH /api/users/{id}/status`, admin only). The
button for it belongs on the admin screens, so it's admin-section work, not staff or
customer. A deactivated customer is already blocked from signing in, and staff see them
marked "Deactivated" in the customer list.

---

## 6. Branch and database status ⚠️

- **Not on GitHub yet:** customer management, profiles, decline quotation, invoice filters,
  customer names on staff screens, demo data and the new tests (66 files). They're on
  Sahil's machine only.
- **Already in Neon:** migration `da1c3bc4ec7c` (customer profiles, decline reason). Until
  the code above is pushed, a teammate running any `alembic` command will see
  "Can't locate revision". **Push soon.**
- **Not on `main` yet:** none of the staff, signup or portal work. `sahil/staff` contains all
  of it, so a single merge into `main` brings everything in.

## 7. Demo data and logins (for the demo)

The data is already in Neon. It shows a business that has been running for about a year.

| Figure (live) | Value |
|---|---|
| Customers | 49 |
| Active subscriptions | 40 |
| Open quotations | 9 |
| Money received | ₹41.0 lakh from 111 payments |
| Still owed | ₹11.8 lakh |
| Overdue invoices | 19 |
| Draft invoices to review | 11 |

| Login | Password | Shows |
|---|---|---|
| `staff@demo.brightloop.com` | `Staff@Demo2026` | Staff panel with all the data |
| `aarav@demo.brightloop.com` | `Customer@Demo2026` | Paid, part-paid and overdue invoices |
| `priya@demo.brightloop.com` | `Customer@Demo2026` | An open quotation to accept or decline |
| `rohan@demo.brightloop.com` | `Customer@Demo2026` | Accepted, waiting for staff to activate |
| `neha@demo.brightloop.com` | `Customer@Demo2026` | A declined quotation with a reason |
| `kabir@demo.brightloop.com` | `Customer@Demo2026` | A weekly plan with a fresh draft invoice |
| `ananya@demo.brightloop.com` | `Customer@Demo2026` | A finished (closed) subscription |
| `new@demo.brightloop.com` | `Customer@Demo2026` | A new customer with no quotations yet (welcome screen); profile filled in as "Naveen Khanna" |
| `walkin.e2e@demo.brightloop.com` | `Welcome@123` | Created by the live test: one paid invoice and one declined quotation |

The 49 customers are 48 demo accounts plus the original `customer@brightloop.com`.
Every demo account ends in `@demo.brightloop.com`. To remove all of it after the hackathon,
and nothing else: `uv run python -m app.jobs.demo_data --remove`. Don't add more; this set
is enough.

## 8. How it was tested

- **78 automated backend tests** (`uv run pytest`): quotation lifecycle, billing (month ends,
  catch-up, no duplicates, expiry), payments (partial, full, overpayment), staff customer
  management, the customer portal (accept, decline, filters, profile), who can see what, and
  that the demo data adds up.
- **41 live checks** against the running app and Neon: every staff and portal screen loads,
  and every API call they make returns the right data.
- **Frontend:** lint, type check and production build all pass.
- **Data check in Neon:** no duplicate billing periods, every invoice's paid amount matches
  its payments, and no payments are dated in the future.
- **Not yet done:** a person clicking through the app in a browser.
