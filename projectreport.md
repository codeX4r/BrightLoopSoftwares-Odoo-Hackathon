# Project report: Staff panel and Customer portal

Last updated: 2026-10-31 13:45 IST
Owners: Sahil (staff panel and its backend), Parth (customer portal)
Branches: `sahil/staff` (`65338c8`) and `parth/customerManagement`, which contains all of
`sahil/staff` plus Parth's change-password work. Both include `main`, customer signup and
the portal.

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
| Change password (customers, staff, admin) | ✅ Working (Parth, see section 3) |
| Tests | ✅ Backend tests pass, live checks pass, frontend lint and type check pass |
| Demo data | ✅ Loaded in Neon (49 customers, most with a year of history) |
| Pushed to GitHub | ✅ `sahil/staff` at 13:37; `parth/customerManagement` at 13:45 |
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
| Account (`/staff/account`) | Change their own password by entering the current one. At least 12 characters with uppercase, lowercase and a special character. Admins can use the same API (`POST /api/staff/account/password`). |

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
| Account (`/portal/account`) | Change their password by entering the current one (signup password rule). |

**Change password (both portal and staff):** the current password must be right and the
new one must differ. Wrong attempts count toward the login limits, so after too many the
form asks the user to wait. On success the user stays signed in on this device and is
signed out everywhere else.

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
| Admins changing their password in the browser | An `/admin` panel (doesn't exist yet) | Admins can call `POST /api/staff/account/password` |

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
| Change password while signed in | ✅ Done (Parth) | Customers, staff and admin |
| Emailing invoices and quotations | Partly done | "Mark as sent" plus print/PDF work; real sending needs an email service |
| Billing runs every day on its own | Ready, not scheduled | The job exists (`uv run python -m app.jobs.billing`); schedule it as a daily cron job when deploying, for example on Render. Until then use "Generate due invoices" on the dashboard. |
| Staff deactivating a customer | Decision needed | Today only an admin can do it (`/api/users/{id}/status`) |
| Limit on sign-ups per person | Not started | Low priority for the demo |

### Features that need email

No branch has mail-sending code (no SMTP, provider library or mail settings). One shared
email service (provider, settings in `.env`, a `send_email` helper) would cover all of these.
Nobody owns it yet.

| Feature | Required by the brief? | Today | Owner |
|---|---|---|---|
| Forgot password reset link | Yes | CLI `reset-password` only | Auth (Adarsh) |
| Send invoice to customer | Yes ("send invoices") | Marks as sent; customers see it in the portal | Staff (Sahil) |
| Send quotation to customer | Implied | Status change; customers see it in the portal | Staff (Sahil) |
| Signup verification, payment receipts, overdue and renewal reminders | No | Not built | Unassigned |

---

## 6. Branch and database status

- **On GitHub:** `sahil/staff` (`65338c8`) has customer management, profiles, decline
  quotation, invoice filters, demo data and the new tests. `parth/customerManagement` has
  all of that plus change password.
- **Neon:** at migration `da1c3bc4ec7c` (customer profiles, decline reason). The code for it
  is now on GitHub, so `alembic` works for everyone after pulling. Change password needed no
  migration.
- **Not on `main` yet:** none of the staff, signup, portal or change-password work. Merging
  `parth/customerManagement` into `main` brings everything in. Agree the order first.
- **Shared frontend setting:** `frontend/next.config.ts` sets
  `experimental.instantInsights.validationLevel = "manual-warning"`. Every staff and portal
  page loads data in the browser after the login check, so the Next.js instant-navigation
  check flagged all of them in development. Now only pages that export `instant = true`
  are checked. Users were never affected.

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

**Careful when testing change password:** changing a demo account's password in the
browser changes it in Neon for everyone. Change it back afterwards, or test with a new
account from `/signup`.

## 8. How it was tested

- **Automated backend tests** (`uv run pytest`): quotation lifecycle, billing (month ends,
  catch-up, no duplicates, expiry), payments (partial, full, overpayment), staff customer
  management, the customer portal (accept, decline, filters, profile), who can see what, and
  that the demo data adds up.
- **41 live checks** (Sahil) against the running app and Neon: every staff and portal
  screen loads, and every API call they make returns the right data.
- **Change password** (Parth): 18 API checks against an in-memory database: wrong current
  password, weak or unchanged new password, the 12-character staff minimum, wrong role,
  missing CSRF header, rate limiting, other sessions signed out, old password rejected and
  new one accepted.
- **Frontend:** lint and type check pass.
- **Data check in Neon:** no duplicate billing periods, every invoice's paid amount matches
  its payments, and no payments are dated in the future.
- **Not yet done:** a person clicking through the app in a browser.

---

## 9. Activity log

Newest first. Every action by Parth and every teammate commit on any branch.

| Time (IST) | Who | Branch | What |
|---|---|---|---|
| 13:45 | Parth | `parth/customerManagement` | Merged `sahil/staff` (`2de6135`, `65338c8`) into my branch with the change-password commit `43ef40a`; resolved 5 conflicts (route registration, sidebars, API client, this report); pushed |
| 13:37 | Sahil | `sahil/staff` | `65338c8` readme: updated staff and customer demo passwords |
| 13:37 | Sahil | `sahil/staff` | `2de6135` customer management, customer profiles, quotation decline, portal invoice filters, demo data, migration `da1c3bc4ec7c`, rewrote this report |
| 13:35 | Parth | `parth/customerManagement` | Fixed the instant-navigation dev warning on every page with one setting in `next.config.ts` |
| 13:29 | Parth | `parth/customerManagement` | Fixed the instant-navigation warning on `/staff/account` |
| 13:27 | Parth | `parth/customerManagement` | Added change password for staff and admin: `POST /api/staff/account/password` and `/staff/account` |
| 13:14 | Parth | `parth/customerManagement` | Added change password for customers: `POST /api/portal/account/password` and `/portal/account` |
| 13:04 | Parth | all | Audited email usage: no mail-sending code on any branch (see section 5) |
| 13:02 | Parth | all | Fetched all branches: no new teammate commits |
| 12:33 | Parth | `parth/customerManagement` | Checked that commit `1b9bdb4` changes frontend files only |
| 12:31 | Parth | `parth/customerManagement` | `1b9bdb4` committed and pushed the customer portal |
| 12:27 | Parth | `parth/customerManagement` | Adapted the portal to signup: welcome screen for new customers |
| 12:20 | Parth | `parth/customerManagement` | Started this report at the repo root |
| 12:06 | Sahil | `sahil/staff` | `e4e377c` login: show Sign up as a button |
| 12:04 | Sahil | `sahil/staff` | `183d4a3` merged `sahil/customer-signup` |
| 12:03 | Sahil | `sahil/customer-signup` | `5fbd96b` customer-only self signup |
| 12:00 | Parth | `parth/customerManagement` | Fixed the instant-navigation warning on the portal pages |
| 11:50 | Parth | `parth/customerManagement` | Built the portal pages: overview, subscriptions, accept quotation, invoices |
| 11:40 | Sahil | `sahil/staff` | `6c1232d` staff panel, billing, and the portal endpoints in `billing.py` |
| 10:53 | Adarsh | `main` | `d3b9e26` replaced JWT with database sessions, added `reset-password` CLI |
| 10:33 | Adarsh | `main` | `8c28960` documented demo accounts and Alembic seeding |
| 10:30 | Adarsh | `adarsh` | `3db69a9` fixed auth |
| 10:11 | Adarsh | `adarsh` | `38e1b33` auth done |
| 09:38 | Sahil | — | `857a3c7` initial backend and frontend setup |
