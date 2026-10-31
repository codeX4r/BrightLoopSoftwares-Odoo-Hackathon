const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Formats a backend money string such as "2560.00" as ₹2,560.00. */
export function formatINR(value: string | number): string {
  return inr.format(Number(value));
}

/**
 * Formats a backend date (YYYY-MM-DD, or a full timestamp) without shifting the day
 * across time zones.
 */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** True for values such as "1200", "1200.5" or "1200.50": non-negative, at most 2 decimals. */
export function isMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
