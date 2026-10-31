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

export function listMyInvoices(page = 1, pageSize = 20) {
  return apiRequest<Page<InvoiceSummary>>(`/api/portal/invoices?${pageQuery(page, pageSize)}`);
}

export function getMyInvoice(id: string) {
  return apiRequest<Invoice>(`/api/portal/invoices/${encodeURIComponent(id)}`);
}

/** True when a quotation's validity date has passed (compared as YYYY-MM-DD strings). */
export function isQuotationExpired(sub: SubscriptionSummary, today: string): boolean {
  return (
    sub.status === "QUOTATION" &&
    sub.quotation_valid_until !== null &&
    sub.quotation_valid_until < today
  );
}
