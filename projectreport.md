# Project report: Subscription Management System

Last updated: 2026-10-31, about 15:00 IST
Team: Sahil (staff panel, billing, customer backend), Parth (customer portal pages,
change password), Adarsh (auth, admin panel: catalog, taxes, discounts, reports, settings)
Working branch: `sahil/staff`. It contains every teammate branch: `main`,
`sahil/customer-signup`, `parth/customerManagement` and `integration/staff-catalog`.
Email features are left out of this report on purpose; they come later (section 9).

**In one line:** all three areas exist and work on their own. Admin can manage the
catalog, taxes, discounts, reports and settings; staff can quote, bill and collect;
customers can sign up, accept and pay. **The main gap is the link between them:**
quotations and invoices don't use the admin's products, plans, taxes and discounts yet.

---

## 1. Status at a glance

| Area | Status |
|---|---|
| Admin panel (`/admin`) | 🟡 Screens and API built (Adarsh). Some labels are stale and the page can render broken in dev (section 5) |
| Staff panel (`/staff`) | ✅ Working. Quotation lines are still typed in by hand, not picked from the catalog |
| Customer portal (`/portal`) | ✅ Working. No pause, renew or early close buttons yet |
| Admin ↔ staff link (catalog in quotations, tax rules, discounts, plan rules) | 🟡 About 40% done: backend drafted but not finished (section 4, item 1) |
| Backend tests | ✅ 306 pass, 2 skipped (they need a real Postgres) |
| Frontend | ✅ Lint, type check and production build pass |
| Database (Neon) | ✅ Up to date: migration `1cf8cdceca29`, 24 tables |
| GitHub | ⚠️ `sahil/staff` has 16 local commits not pushed yet; `main` is 24 commits behind |
| Deployment | ❌ Not started |
| Click-through test in a browser | ❌ Not done for any role |

**Rough time to finish everything except email: about 25–35 hours of work** (3–4 days
for one person, or about 1.5–2 days split across three). Details per item in section 4.

---

## 2. Git and database status

| Item | State |
|---|---|
| Local `sahil/staff` | `b78e96a`. Merges Parth's change password and Adarsh's `integration/staff-catalog`. 306 tests pass on it |
| `origin/sahil/staff` | `878a785`: **16 commits behind local.** Push before anyone pulls |
| `origin/main` | `d3b9e26`, auth only. Fast-forwarding it to `sahil/staff` brings everything in with no conflicts |
| Neon migration | `1cf8cdceca29`, the merge point of the staff (`da1c3bc4ec7c`) and admin (`e2b6c9f0a7d1` → `f4a7b2c9d1e3`) migrations. **Those files exist only in the local branch.** Until it's pushed, teammates' `alembic` commands fail with "Can't locate revision" |
| Unfinished work | Kept safely in `git stash` ("WIP: link quotations to admin catalog…"), not in the working tree, so the running app stays consistent with Neon |

Merge conflicts fixed while combining the branches:
- **One customer profile model.** Both sides had defined `customer_profiles`. It now lives in `app/models/profiles.py`, and `customer_profile.py` re-exports it.
- **`profile_service.py`** keeps both teams' functions.
- **The test helpers** serve both test suites.

---

## 3. What works, by area

### Admin panel (`/admin`, Adarsh)

| Screen | What the admin can do | Backend |
|---|---|---|
| Dashboard | Customers, active subscriptions, cash received, outstanding, catalog counts | ✅ |
| Products and variants | Create, edit and archive products (type, sales and cost price, description); add variants with an extra price | ✅ `/api/admin/products`, `/variants` |
| Product types | Create types such as Service or Good | ✅ |
| Subscription plans | Price, billing frequency, minimum quantity, available from and until, auto-close, allow pause, renew and early close | ✅ `/api/admin/plans` |
| Taxes | Rate, type, default tax, apply to products or product types | ✅ `/api/admin/taxes` |
| Discounts | Fixed or %, minimum purchase and quantity, dates, usage limit, whole subscription or specific products, preview | ✅ `/api/admin/discounts` |
| Reports | Revenue and subscription reports with date ranges | ✅ `/api/admin/reports/*` |
| Settings | Company details, currency, timezone, invoice prefix (used for new invoice numbers) | ✅ `/api/admin/settings` |
| Customers and staff | Lists with billing figures, create staff, edit staff, **activate or deactivate** customers and staff | ✅ `/api/admin/customers`, `/staff` |
| Quotations, subscriptions, invoices, payments | Opens the staff panel; admins are allowed there | ✅ |

### Staff panel (`/staff`, Sahil)

| Screen | What staff can do |
|---|---|
| Dashboard | Customers, active subscriptions, open quotations, revenue (date filter), outstanding, overdue, recent activity, generate due invoices |
| Customers | Search by name, company, email or phone; add with a login; edit contact details; full history with totals |
| Quotations & subscriptions | Create, edit the draft, send with validity, mark accepted, activate, close, download PDF, see declines with reasons |
| Invoices | Generated automatically per billing period with no duplicates and catch-up; confirm, cancel, mark sent, print or PDF; paid, unpaid and overdue |
| Payments | Method, date, transaction ID, part payments, outstanding balance |
| Account | Change password |

### Customer portal (`/portal`, Parth's pages with Sahil's backend)

| Screen | What customers can do |
|---|---|
| Sign up | Customer accounts only; the brief's password rule |
| Overview | Active subscriptions, quotations waiting for them, balance due, overdue |
| My subscriptions | View; **accept** or **decline** a quotation (with a reason) |
| My invoices | Filter by unpaid, overdue, paid or cancelled; print |
| My profile | Name, company, phone, address (staff see them) |
| Account | Change password |

**Access rules:** the backend checks every call. Customers see only their own records, staff
can't open admin APIs, and customers can't open staff APIs.

---

## 4. What's left (everything except email)

Estimates assume one developer who knows the code. "Owner" is a suggestion.

| # | Work | Area | Status | Est. | Owner |
|---|---|---|---|---|---|
| 1 | **Use the admin catalog in quotations.** Pick a plan (price, frequency, minimum quantity) and products/variants on the quotation form; tax filled in from the admin's tax rules. Backend about 70% drafted in the stash; needs a migration, tests and the form UI | Staff ↔ Admin | 🟡 Started | 5–7 h | Sahil |
| 2 | **Apply admin discounts to invoices.** Best eligible discount, applied before tax, use counted when the invoice is confirmed, given back on cancel; shown on invoice screens and PDFs. Backend drafted in the stash | Staff ↔ Admin | 🟡 Started | 2–3 h | Sahil |
| 3 | **Plan rules: pause, resume, renew, close early, auto-close at expiry.** Buttons for staff and customers, shown only when the plan allows them. Backend drafted in the stash | Staff + Customer ↔ Admin | 🟡 Started | 3–4 h | Sahil (API), Parth (portal buttons) |
| 4 | **Quotation templates.** Save a plan with lines and validity; start a quotation from it. Backend drafted in the stash | Staff | 🟡 Started | 2–3 h | Sahil |
| 5 | **Fix the admin page UI** (section 5): stale "SOON" labels on Taxes, Discounts, Reports and Settings; the dashboard's "Not built yet" box; the broken sidebar in dev | Admin | ❌ | 1 h | Adarsh |
| 6 | **One consistent look.** Today there are 3 component sets (`components/ui`, `components/staff/ui.tsx`, `components/admin`) and 2 layouts: a dark sidebar for admin and a top bar for staff and portal. Pick one design and apply it everywhere | All | ❌ | 4–6 h | Shared |
| 7 | **Company settings on documents.** Quotation and invoice PDFs hard-code "Brightloop Software"; use the admin's company name, address and phone | Staff + Customer ↔ Admin | ❌ | 1 h | Sahil |
| 8 | **Demo catalog data.** Neon has 0 products, 0 plans, 0 discounts and 1 default tax, so admin screens look empty. Add a few, plus quotations that use them | All | ❌ | 1 h | Sahil |
| 9 | **Click-through test in a browser** of every screen for all three roles | All | ❌ | 2–3 h | Shared |
| 10 | **Run the 2 Postgres-only tests** (row locking, concurrent discount use) against a test database | Backend | ❌ | 0.5 h | Any |
| 11 | **Deploy** (section 6) | All | ❌ | 3–5 h | Shared |
| 12 | **Push and merge to `main`**, then everyone pulls `main` | Git | ❌ | 0.5 h | Sahil |

**Total: about 25–35 hours.** Items 1–4 are the critical path: they connect admin, staff and
customer, and they need about 12–17 hours.

**Smallest set before merging to `main`:** item 12, item 5 and a quick pass of item 9
(3–4 hours). Everything there works today, without the catalog link.

---

## 5. Known issues and bugs

| Issue | Where | Cause | Fix |
|---|---|---|---|
| Admin dashboard showed "Failed to fetch" under Catalog | `/admin` | The admin's catalog tables weren't in Neon yet, so the backend errored without CORS headers | ✅ Fixed: Neon migrated to `1cf8cdceca29`. All 8 admin APIs now return 200 |
| Admin sidebar showed as plain text over the page, without its dark style | `/admin` | Most likely the dev server's styles went stale: `.next` was deleted and rebuilt by `npm run build` while `npm run dev` was running. The production build has the right styles | Stop `npm run dev`, delete `frontend/.next`, start `npm run dev` again. Confirm in the browser |
| Sidebar marks Taxes, Discounts, Reports and Settings as "SOON" though they work | `components/admin/nav.ts` | `ready: false` was never updated | Set `ready: true` (item 5) |
| Dashboard says "Not built yet: Taxes and discounts, Revenue reports" | `app/admin/page.tsx` | Text left over from before those modules existed | Replace with real figures or remove (item 5) |
| Quotation and invoice lines don't use the catalog | Staff | Integration not finished | Items 1–2 |
| Plan rules aren't enforced; subscriptions don't auto-close at expiry | Staff, portal | Integration not finished | Item 3 |
| Payment figures show no discount line | Invoices | Discounts not applied yet | Item 2 |
| 2 tests skipped | Backend | Need a real Postgres | Item 10 |

**Security housekeeping before deploying:**
- The Neon password was shared in chat; rotate it.
- The demo passwords in `readme.md` are public; change them on any database that isn't for the demo.
- Set a fresh `JWT_SECRET_KEY` and `ENVIRONMENT=production`.

---

## 6. Deployment: not started

| Piece | What's needed |
|---|---|
| Backend | Host on Render (web service): `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set `DATABASE_URL`, `JWT_SECRET_KEY`, `ENVIRONMENT=production`, `CORS_ORIGINS` |
| Migrations | Run `uv run alembic upgrade head` on deploy |
| Daily billing | Render cron job: `uv run python -m app.jobs.billing` once a day |
| Frontend | Vercel or Render; set `NEXT_PUBLIC_API_URL` to the backend URL |
| Login cookie across sites | If frontend and backend are on different domains, set `AUTH_COOKIE_SAMESITE=none` with `AUTH_COOKIE_SECURE=true`; otherwise login won't stick |
| Config files | None in the repo yet (no `render.yaml` or Dockerfile) |

---

## 7. Testing

| Check | Result |
|---|---|
| Backend automated tests (`uv run pytest`) | **306 passed, 2 skipped** on the merged branch: auth, signup, users, catalog, taxes, discounts, reports, settings, people, subscriptions, billing, payments, staff customers, portal, demo data |
| Live API check (just now, against Neon) | Staff: dashboard, subscriptions, invoices, payments, customers all 200. Admin: products, plans, taxes, discounts, settings, reports, customers, staff all 200 |
| Frontend | Lint, type check and production build pass on the merged branch |
| Neon data checks | No duplicate billing periods; every invoice's paid amount matches its payments; no future-dated payments |
| Browser click-through | **Not done** (item 9) |

---

## 8. Demo data and logins

Staff and customer data is in Neon: 49 customers, 40 active subscriptions, 9 open
quotations, ₹41.0 lakh received from 111 payments, ₹11.8 lakh owed, 19 overdue invoices.
**The catalog is empty** (item 8).

| Login | Password | Shows |
|---|---|---|
| `admin@brightloop.com` | `Admin@123456` | Admin panel |
| `staff@demo.brightloop.com` | `Staff@Demo2026` | Staff panel with all the data |
| `aarav@demo.brightloop.com` | `Customer@Demo2026` | Paid, part-paid and overdue invoices |
| `priya@demo.brightloop.com` | `Customer@Demo2026` | An open quotation to accept or decline |
| `rohan@demo.brightloop.com` | `Customer@Demo2026` | Accepted, waiting for staff to activate |
| `neha@demo.brightloop.com` | `Customer@Demo2026` | A declined quotation with a reason |
| `kabir@demo.brightloop.com` | `Customer@Demo2026` | A weekly plan with a fresh draft invoice |
| `ananya@demo.brightloop.com` | `Customer@Demo2026` | A finished (closed) subscription |
| `new@demo.brightloop.com` | `Customer@Demo2026` | New customer (welcome screen) |

Remove all demo data (and nothing else) after the hackathon:
`uv run python -m app.jobs.demo_data --remove`. Changing a demo password in the browser
changes it in Neon for everyone.

---

## 9. Left out on purpose: email

These are planned for later and aren't counted in the estimates above.

| Feature | Today |
|---|---|
| Forgot password by email | Backend exists on the admin branch (`/api/auth/password-reset/*`, logs the email to the console in development); no page in the frontend |
| Send invoice or quotation by email | "Mark as sent" plus PDF; customers also see them in the portal |
| Receipts, overdue and renewal reminders | Not built |

---

## 10. Activity log

Newest first.

| Time (IST) | Who | Branch | What |
|---|---|---|---|
| 15:00 | Sahil | `sahil/staff` | Audit and this report; moved unfinished catalog-link work to `git stash` |
| 14:35 | Sahil | Neon | Applied admin migrations and merge point `1cf8cdceca29` (additive: catalog, taxes, discounts, settings, staff profiles, reset tokens) |
| 14:30 | Sahil | `sahil/staff` | `b78e96a` merged `integration/staff-catalog`; resolved 3 conflicts; 306 tests pass |
| 14:05 | Sahil | `sahil/staff` | `5995a1e` merged `parth/customerManagement` (change password) |
| 13:55 | Adarsh | `integration/staff-catalog` | `9304fbc` taxes, discounts, settings, reports, profiles, password reset, admin screens |
| 13:50 | Sahil | `sahil/staff` | `878a785` report: customer deactivation is admin-only |
| 13:45 | Parth | `parth/customerManagement` | Merged `sahil/staff` with change password `43ef40a` |
| 13:37 | Sahil | `sahil/staff` | `2de6135` customer management, profiles, decline, invoice filters, demo data |
| 13:27 | Parth | `parth/customerManagement` | Change password for staff and admin |
| 13:14 | Parth | `parth/customerManagement` | Change password for customers |
| 12:31 | Parth | `parth/customerManagement` | `1b9bdb4` customer portal pages |
| 12:03 | Sahil | `sahil/customer-signup` | `5fbd96b` customer-only signup |
| 11:40 | Sahil | `sahil/staff` | `6c1232d` staff panel and billing |
| 10:53 | Adarsh | `main` | `d3b9e26` database sessions, reset-password CLI |
| 09:38 | Sahil | — | `857a3c7` initial setup |
