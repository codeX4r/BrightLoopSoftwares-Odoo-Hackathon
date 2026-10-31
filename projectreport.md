# Project report: customer portal

Owner: Parth (customer portal). Branch: `parth/customerManagement`, at `e4e377c`
(includes `main`, `sahil/staff` and `sahil/customer-signup`).
Last updated: 2026-10-31 12:31 IST.

Remote branches (all included in `parth/customerManagement` as of 12:31):
`main` `d3b9e26`, `adarsh` `3db69a9`, `sahil/staff` `e4e377c`,
`sahil/customer-signup` `5fbd96b`.

## Activity log

Newest first. Covers my work and teammates' commits on any branch.

| Time (IST) | Who | Branch | What |
|---|---|---|---|
| 12:31 | Parth | `parth/customerManagement` | Committed and pushed the customer portal to `origin/parth/customerManagement` (eslint, tsc, 59 backend tests pass) |
| 12:29 | Parth | all | Report check: synced Next and Dependencies with the signup changes; fetched all branches, no new teammate commits |
| 12:27 | Parth | `parth/customerManagement` | Adapted portal to Sahil's signup: welcome state for new customers, shared portal user context; signup-to-portal flow verified |
| 12:24 | Parth | all | Fetched all branches: no new teammate commits; fast-forwarded local `sahil/staff` to `e4e377c` |
| 12:20 | Parth | `parth/customerManagement` | Moved this report to the repo root; set up auto-reporting |
| 12:10 | Parth | `parth/customerManagement` | Fast-forwarded to `e4e377c` to pick up customer signup; 59 backend tests pass |
| 12:06 | Sahil | `sahil/staff` | `e4e377c` login: show Sign up as a button |
| 12:04 | Sahil | `sahil/staff` | `183d4a3` merged `sahil/customer-signup` |
| 12:03 | Sahil | `sahil/customer-signup` | `5fbd96b` customer-only self signup (`POST /api/auth/signup`, `/signup` page, password rule) |
| 12:00 | Parth | `parth/customerManagement` | Fixed the Next.js instant-navigation warning on all /portal pages |
| 11:50 | Parth | `parth/customerManagement` | Built /portal pages: overview, subscriptions, accept quotation, invoices (uncommitted) |
| 11:40 | Sahil | `sahil/staff` | `6c1232d` staff panel, billing, and the 5 `/api/portal/*` endpoints in `billing.py` |
| 10:53 | Adarsh | `main` | `d3b9e26` replaced JWT with database sessions, added `reset-password` CLI |
| 10:33 | Adarsh | `main` | `8c28960` documented demo accounts and Alembic seeding |
| 10:30 | Adarsh | `adarsh` | `3db69a9` fixed auth |
| 10:11 | Adarsh | `adarsh` | `38e1b33` auth done |
| 09:38 | Sahil | — | `857a3c7` initial backend and frontend setup |

## Done (customer portal)

| Item | Files | Verified |
|---|---|---|
| Portal layout with customer-only guard and sidebar | `frontend/src/app/portal/layout.tsx`, `frontend/src/components/portal/portal-shell.tsx`, `portal-nav.tsx` | Routes return 200 |
| Overview: active subscriptions, quotations to review, balance due, overdue | `frontend/src/app/portal/portal-overview.tsx` | tsc, eslint |
| My subscriptions list and detail | `frontend/src/app/portal/subscriptions/…` | API flow script |
| Accept quotation (asks to confirm first, hidden once expired) | `subscriptions/[id]/subscription-detail.tsx` | Accept works; re-accept 409; other customer 404 |
| My invoices list and printable detail with payments | `frontend/src/app/portal/invoices/…` | Partial payment shows paid and due |
| API client for the 5 portal endpoints | `frontend/src/lib/portal-api.ts` | tsc |
| Next.js instant-navigation warning fixed | each portal `page.tsx` exports `instant = false` | Dev log clean |
| Welcome state for new (self-registered) customers: 3-step "how it works" and their account email to quote | `frontend/src/app/portal/portal-overview.tsx` | tsc, eslint |
| Signed-in customer shared with portal pages (`usePortalUser`) | `frontend/src/components/portal/portal-shell.tsx` | tsc |
| Signup works with the portal: signup → empty portal → staff finds customer → quotation → accept | (verification only) | 13 API checks pass |

Pushed to `origin/parth/customerManagement`.

## Next

1. Open a pull request from `parth/customerManagement` into `main` when the team is
   ready to merge.
2. Test the pages in a browser with real data: sign up at `/signup` (or use
   `customer@brightloop.com`), staff sends a quotation, then the customer accepts it and
   views the invoice.
3. Customer profile (name, company, phone, address): model, Alembic migration,
   `GET/PATCH /api/portal/profile`, `/portal/profile` page. Confirm ownership first.
4. Change password while signed in (`/portal/account`), using the same password rule as
   signup.
5. Invoice filters on `/portal/invoices` (unpaid, overdue, paid).

## Dependencies on other modules

| Portal feature | Status | Waiting on |
|---|---|---|
| Customer self-registration | Done | — (Sahil, `5fbd96b`) |
| Forgot password with an email link | Missing | Auth (Adarsh) plus an email provider |
| Customer name, company, address | Missing | Customer profile; owner unconfirmed. Signup only collects email and password, so staff see customers by email until this exists |
| Pause, renew or close early | Missing | Admin plan rules plus new endpoints |
| Reject a quotation | Missing | Staff/billing, `billing.py` (Sahil) |
| Invoice status filter for customers | Missing | `billing.py` (Sahil) |
| Real product, variant and plan names, taxes, discounts | Free-text lines | Admin module (no owner yet) |
| Emailing invoices | Not available | Email provider |
