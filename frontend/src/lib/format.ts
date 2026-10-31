/**
 * Shared display helpers for the admin, staff and portal screens.
 *
 * Money arrives from the backend as decimal strings ("2560.00") and is never parsed into
 * arithmetic here; these functions only format it.
 */
import type {
  BillingFrequency,
  InvoiceStatus,
  PaymentMethod,
  SubscriptionStatus,
} from "@/lib/staff-api";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** Formats a decimal string or number as ₹1,23,456.78. Empty values show "—". */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? inr.format(amount) : "—";
}

const inrTwoDecimals = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Formats a backend money string such as "2560.00" as ₹2,560.00 (admin catalog). */
export function formatINR(value: string | number): string {
  return inrTwoDecimals.format(Number(value));
}

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Formats a calendar date ("2026-10-31") as 31 Oct 2026. For a full timestamp, the date
 * part before the time is used. The day never shifts across time zones.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return dateFormat.format(new Date(year, month - 1, day));
}

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

/** Today's date in India time as YYYY-MM-DD, matching the backend's business day. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** True for values such as "1200", "1200.5" or "1200.50": non-negative, at most 2 decimals. */
export function isMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  DRAFT: "Draft",
  QUOTATION: "Quotation",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

/** Shared by the staff screens and the admin catalog (re-exported from admin-api). */
export const FREQUENCY_LABEL: Record<BillingFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CARD: "Card",
  CHEQUE: "Cheque",
  OTHER: "Other",
};
