import { apiRequest } from "@/lib/api";
import type {
  Invoice,
  InvoiceSummary,
  Page,
  Subscription,
  SubscriptionSummary,
} from "@/lib/staff-api";

/**
 * Customer portal calls (/api/portal/*). The backend only returns the signed-in
 * customer's own records: drafts are hidden and other customers' ids return 404.
 */

/** Largest page the portal endpoints accept (MAX_PAGE_SIZE on the backend). */
export const PORTAL_MAX_PAGE_SIZE = 100;

function pageQuery(page: number, pageSize: number): string {
  return new URLSearchParams({ page: String(page), page_size: String(pageSize) }).toString();
}

export function listMySubscriptions(page = 1, pageSize = 20) {
  return apiRequest<Page<SubscriptionSummary>>(
    `/api/portal/subscriptions?${pageQuery(page, pageSize)}`,
  );
}

export function getMySubscription(id: string) {
  return apiRequest<Subscription>(`/api/portal/subscriptions/${encodeURIComponent(id)}`);
}

/** Accepts a quotation: QUOTATION -> CONFIRMED. Staff then activate it. */
export function acceptQuotation(id: string) {
  return apiRequest<Subscription>(`/api/portal/subscriptions/${encodeURIComponent(id)}/accept`, {
    method: "POST",
  });
}

/** Pause, resume, renew or close early, as far as the subscription's plan allows. */
export function subscriptionAction(id: string, action: "pause" | "resume" | "renew" | "close") {
  return apiRequest<Subscription>(`/api/portal/subscriptions/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
  });
}

/** Declines a quotation: QUOTATION -> CLOSED, with an optional reason shown to staff. */
export function rejectQuotation(id: string, reason: string | null) {
  return apiRequest<Subscription>(`/api/portal/subscriptions/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { reason },
  });
}

/** Invoice filter for customers. "UNPAID" = confirmed with a balance; "OVERDUE" = past due. */
export type MyInvoiceFilter = "" | "UNPAID" | "OVERDUE" | "PAID" | "CANCELLED";

export function listMyInvoices(page = 1, pageSize = 20, filter: MyInvoiceFilter = "") {
  const params = new URLSearchParams(pageQuery(page, pageSize));
  if (filter === "UNPAID") params.set("status", "CONFIRMED");
  else if (filter === "OVERDUE") params.set("overdue", "true");
  else if (filter) params.set("status", filter);
  return apiRequest<Page<InvoiceSummary>>(`/api/portal/invoices?${params}`);
}

export type MyProfile = {
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  address: string | null;
  updated_at: string | null;
};

export function getMyProfile() {
  return apiRequest<MyProfile>("/api/portal/profile");
}

export function updateMyProfile(body: {
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  address: string | null;
}) {
  return apiRequest<MyProfile>("/api/portal/profile", { method: "PATCH", body });
}

export function getMyInvoice(id: string) {
  return apiRequest<Invoice>(`/api/portal/invoices/${encodeURIComponent(id)}`);
}

/**
 * Changes the signed-in customer's password. Other sessions are signed out; this one
 * stays signed in. Wrong current password -> 400, weak/unchanged new password -> 422.
 */
export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>("/api/portal/account/password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

/** True when a quotation's validity date has passed (compared as YYYY-MM-DD strings). */
export function isQuotationExpired(sub: SubscriptionSummary, today: string): boolean {
  return (
    sub.status === "QUOTATION" &&
    sub.quotation_valid_until !== null &&
    sub.quotation_valid_until < today
  );
}
