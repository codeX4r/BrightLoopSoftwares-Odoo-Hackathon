# Project report: customer portal

Owner: Parth (customer portal). Branch: `parth/customerManagement`, at `1b9bdb4`
(pushed; includes `main`, `sahil/staff` and `sahil/customer-signup`).
Last updated: 2026-10-31 13:35 IST.

Remote branches (all included in `parth/customerManagement` as of 13:35):
`main` `d3b9e26`, `adarsh` `3db69a9`, `sahil/staff` `e4e377c`,
`sahil/customer-signup` `5fbd96b`, `parth/customerManagement` `1b9bdb4`.

## Activity log

Newest first. Covers my work and teammates' commits on any branch.

| Time (IST) | Who | Branch | What |
|---|---|---|---|
| 13:35 | Parth | `parth/customerManagement` | Fixed the instant-navigation dev warning on every page (incl. Sahil's `/staff` pages) with one setting in `frontend/next.config.ts`: `experimental.instantInsights.validationLevel = "manual-warning"`. No staff page files changed; all 15 pages clean in the dev log |
| 13:29 | Parth | `parth/customerManagement` | Fixed the Next.js instant-navigation warning on `/staff/account` (server `page.tsx` with `instant = false`, form in `staff-account.tsx`); dev log clean |
| 13:27 | Parth | `parth/customerManagement` | Added change password for staff and admin: `POST /api/staff/account/password` and `/staff/account`; shared form and request handling with the portal (uncommitted). Touches 3 of Sahil's files by one registration line each |
| 13:14 | Parth | `parth/customerManagement` | Added change password with current password: `POST /api/portal/account/password` and `/portal/account` page (uncommitted) |
| 13:04 | Parth | all | Audited email usage: no branch has any mail-sending code; listed features that need email (see Dependencies) |
| 13:02 | Parth | all | Fetched all branches: no new teammate commits since 12:06; nothing to pull |
| 12:33 | Parth | `parth/customerManagement` | Checked: commit `1b9bdb4` changes 14 frontend files and this report, no backend files; backend changes on the branch are Sahil's |
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
| Change password with current password (customers): checks current password, signup password rule, must differ, wrong attempts rate-limited, other sessions signed out | `backend/app/api/routes/portal/account.py`, `backend/app/services/account_service.py`, `backend/app/schemas/account.py`, `frontend/src/app/portal/account/…`, `portal-api.ts`, `portal-nav.tsx` | 15 API checks; ruff, 59 tests, eslint, tsc |
| Change password with current password (staff and admin): same checks, new password needs at least 12 characters plus upper, lower and special | `backend/app/api/routes/staff/account.py`, `backend/app/api/password_change.py` (shared), `frontend/src/app/staff/account/page.tsx` + `staff-account.tsx`, `frontend/src/components/account/change-password-form.tsx` (shared); one line each in Sahil's `staff/__init__.py`, `staff-nav.tsx`, `staff-api.ts` | 18 API checks (staff, admin, customer endpoint unaffected); ruff, 59 tests, eslint, tsc |

Pushed to `origin/parth/customerManagement` up to `1b9bdb4`. Both change-password
features (13:14, 13:27) are not committed yet.

## Next

1. Open a pull request from `parth/customerManagement` into `main` when the team is
   ready to merge.
2. Test the pages in a browser with real data: sign up at `/signup` (or use
   `customer@brightloop.com`), staff sends a quotation, then the customer accepts it and
   views the invoice.
3. Customer profile (name, company, phone, address): model, Alembic migration,
   `GET/PATCH /api/portal/profile`, `/portal/profile` page. Confirm ownership first.
4. Commit and push both change-password features (customer and staff).
5. Invoice filters on `/portal/invoices` (unpaid, overdue, paid).

## Dependencies on other modules

| Portal feature | Status | Waiting on |
|---|---|---|
| Customer self-registration | Done | — (Sahil, `5fbd96b`) |
| Forgot password with an email link | Missing | Auth (Adarsh) plus an email provider. Change password while signed in is done (no email needed) |
| Change password for staff and admin | Done (13:27) | Built in the staff area, Sahil's module: tell Sahil before merging. Admins have no panel yet (`/admin` doesn't exist), so they can only use the API |
| Customer name, company, address | Missing | Customer profile; owner unconfirmed. Signup only collects email and password, so staff see customers by email until this exists |
| Pause, renew or close early | Missing | Admin plan rules plus new endpoints |
| Reject a quotation | Missing | Staff/billing, `billing.py` (Sahil) |
| Invoice status filter for customers | Missing | `billing.py` (Sahil) |
| Real product, variant and plan names, taxes, discounts | Free-text lines | Admin module (no owner yet) |
| Instant-navigation dev warning on `/staff` pages | Fixed (13:35) | Shared `next.config.ts` change: tell the team. Pages are only validated if they export `instant = true` |
| Emailing invoices | Not available | Email provider. Staff "Mark as sent" only records `sent_at`; customers see invoices in the portal |
| Emailing quotations | Not available | Email provider. "Send quotation" only changes status; customers see it in the portal |

### Email audit (13:04)

No branch has mail-sending code (no SMTP, provider SDK or mail settings). Features that need it:

| Feature | Required by brief? | Current state | Owner |
|---|---|---|---|
| Forgot password reset link | Yes | CLI `reset-password` only | Auth (Adarsh) |
| Send invoice to customer | Yes ("send invoices") | Marks as sent, no email | Staff/billing (Sahil) |
| Send quotation to customer | Implied | Status change only | Staff/billing (Sahil) |
| Signup email verification, payment receipts, overdue and renewal reminders | No | Not built | Unassigned |

A shared email service (provider choice, `SMTP_*` or API key settings, a `send_email` helper) is the
common dependency for all of these.
