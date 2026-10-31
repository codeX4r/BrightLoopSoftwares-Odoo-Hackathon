/**
 * Typed calls for taxes, discounts, reports, settings, profiles and staff editing.
 * Money and rates arrive as decimal strings ("5.00", "1099.98").
 */
import { apiRequest } from "@/lib/api";
import type { Page } from "@/lib/admin-api";

type QueryValue = string | number | boolean | null | undefined;

/** Builds a query string, skipping empty values. Unlike admin-api, `false` is sent. */
function query(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type NamedRef = { id: string; name: string };

// --- Taxes -------------------------------------------------------------------

export type Tax = {
  id: string;
  name: string;
  /** Percentage, e.g. "5.00". */
  rate: string;
  tax_type: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  products: NamedRef[];
  product_types: NamedRef[];
  created_at: string;
  updated_at: string;
};

export type TaxInput = {
  name: string;
  rate: string;
  tax_type: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  product_ids: string[];
  product_type_ids: string[];
};

export type TaxFilters = { q?: string; is_active?: boolean; limit?: number; offset?: number };

// --- Discounts ---------------------------------------------------------------

export type DiscountType = "FIXED" | "PERCENTAGE";
export type DiscountScope = "ENTIRE_SUBSCRIPTION" | "SPECIFIC_PRODUCTS";

export type Discount = {
  id: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  value: string;
  min_purchase_amount: string | null;
  min_quantity: number | null;
  start_date: string;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  scope: DiscountScope;
  products: NamedRef[];
  is_active: boolean;
  /** Active, inside its dates and with uses left, as of today (India time). */
  is_valid_today: boolean;
  created_at: string;
  updated_at: string;
};

export type DiscountInput = {
  name: string;
  description: string | null;
  discount_type: DiscountType;
  value: string;
  min_purchase_amount: string | null;
  min_quantity: number | null;
  start_date: string;
  end_date: string | null;
  usage_limit: number | null;
  scope: DiscountScope;
  product_ids: string[];
  is_active: boolean;
};

export type DiscountFilters = {
  q?: string;
  is_active?: boolean;
  discount_type?: DiscountType;
  valid_today?: boolean;
  limit?: number;
  offset?: number;
};

export type PreviewLine = { product_id: string | null; quantity: number; unit_price: string };

export type DiscountPreview = {
  as_of: string;
  subtotal: string;
  discount: NamedRef | null;
  discount_amount: string;
  subtotal_after_discount: string;
};

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  FIXED: "Fixed amount",
  PERCENTAGE: "Percentage",
};

export const DISCOUNT_SCOPE_LABEL: Record<DiscountScope, string> = {
  ENTIRE_SUBSCRIPTION: "Entire subscription",
  SPECIFIC_PRODUCTS: "Specific products",
};

// --- Reports -----------------------------------------------------------------

export type GroupBy = "month" | "year";

export type RevenuePeriod = {
  year: number;
  month: number | null;
  invoiced: string;
  invoices_count: number;
  received: string;
  payments_count: number;
};

export type RevenueReport = {
  date_from: string;
  date_to: string;
  group_by: GroupBy;
  invoiced: string;
  invoices_count: number;
  received: string;
  payments_count: number;
  outstanding: string;
  outstanding_count: number;
  overdue: string;
  overdue_count: number;
  periods: RevenuePeriod[];
};

export type SubscriptionReport = {
  date_from: string;
  date_to: string;
  new_subscriptions: number;
  closed_subscriptions: number;
  expired_subscriptions: number;
  active_subscriptions: number;
  open_quotations: number;
  awaiting_activation: number;
  /** Null: renewals are not built yet, so there is nothing to count. */
  renewed_subscriptions: number | null;
  status_counts: Record<string, number>;
  recurring_revenue_monthly: string;
  recurring_by_frequency: Record<string, string>;
  recurring_revenue_definition: string;
};

export type ReportRange = { date_from: string; date_to: string };

// --- Settings ----------------------------------------------------------------

export type AppSettings = {
  company_name: string;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  currency: string;
  timezone: string;
  invoice_prefix: string;
  updated_at: string;
  supported_currencies: string[];
  supported_timezones: string[];
};

export type SettingsInput = Partial<
  Pick<
    AppSettings,
    | "company_name"
    | "company_address"
    | "company_email"
    | "company_phone"
    | "currency"
    | "timezone"
    | "invoice_prefix"
  >
>;

// --- Profiles ----------------------------------------------------------------

export type CustomerProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  address: string | null;
  /** Null until the profile is saved for the first time. */
  updated_at: string | null;
};

/** Omitted fields stay unchanged; an empty string clears a field. */
export type CustomerProfileInput = Partial<
  Pick<CustomerProfile, "full_name" | "company_name" | "phone" | "address">
>;

export type StaffProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
};

export type StaffInput = Partial<Pick<StaffProfile, "email" | "full_name" | "phone">>;

export const adminModulesApi = {
  listTaxes: (filters: TaxFilters) => apiRequest<Page<Tax>>(`/api/admin/taxes${query(filters)}`),
  createTax: (input: TaxInput) =>
    apiRequest<Tax>("/api/admin/taxes", { method: "POST", body: input }),
  updateTax: (id: string, input: Partial<TaxInput>) =>
    apiRequest<Tax>(`/api/admin/taxes/${id}`, { method: "PATCH", body: input }),

  listDiscounts: (filters: DiscountFilters) =>
    apiRequest<Page<Discount>>(`/api/admin/discounts${query(filters)}`),
  createDiscount: (input: DiscountInput) =>
    apiRequest<Discount>("/api/admin/discounts", { method: "POST", body: input }),
  updateDiscount: (id: string, input: Partial<DiscountInput>) =>
    apiRequest<Discount>(`/api/admin/discounts/${id}`, { method: "PATCH", body: input }),
  previewDiscount: (lines: PreviewLine[], asOf: string | null) =>
    apiRequest<DiscountPreview>("/api/admin/discounts/preview", {
      method: "POST",
      body: { lines, as_of: asOf },
    }),

  revenueReport: (range: ReportRange, groupBy: GroupBy) =>
    apiRequest<RevenueReport>(`/api/admin/reports/revenue${query({ ...range, group_by: groupBy })}`),
  subscriptionReport: (range: ReportRange) =>
    apiRequest<SubscriptionReport>(`/api/admin/reports/subscriptions${query(range)}`),

  getSettings: () => apiRequest<AppSettings>("/api/admin/settings"),
  updateSettings: (input: SettingsInput) =>
    apiRequest<AppSettings>("/api/admin/settings", { method: "PATCH", body: input }),

  getCustomerProfile: (customerId: string) =>
    apiRequest<CustomerProfile>(`/api/customers/${customerId}/profile`),
  updateCustomerProfile: (customerId: string, input: CustomerProfileInput) =>
    apiRequest<CustomerProfile>(`/api/customers/${customerId}/profile`, {
      method: "PATCH",
      body: input,
    }),

  getStaffProfile: (staffId: string) =>
    apiRequest<StaffProfile>(`/api/admin/staff/${staffId}/profile`),
  updateStaff: (staffId: string, input: StaffInput) =>
    apiRequest<StaffProfile>(`/api/admin/staff/${staffId}`, { method: "PATCH", body: input }),
};

/** Public forgot-password calls. The request call never reveals whether the email exists. */
export const passwordResetApi = {
  request: (email: string) =>
    apiRequest<{ detail: string }>("/api/auth/password-reset/request", {
      method: "POST",
      body: { email },
    }),
  confirm: (token: string, newPassword: string) =>
    apiRequest<void>("/api/auth/password-reset/confirm", {
      method: "POST",
      body: { token, new_password: newPassword },
    }),
};
