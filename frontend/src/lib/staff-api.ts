import { ApiError, apiRequest } from "@/lib/api";

export type SubscriptionStatus = "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "CLOSED";
export type BillingFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type InvoiceStatus = "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "UPI" | "CARD" | "CHEQUE" | "OTHER";

/** Money and rates arrive as decimal strings ("1180.00") so no precision is lost. */
export type Decimal = string;

export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

/** Name and company come from the customer's profile and are null until it's filled in. */
export type CustomerSummary = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
};

/** "Aarav Sharma · ABC Technologies", falling back to the email. */
export function customerName(customer: CustomerSummary): string {
  const parts = [customer.full_name, customer.company_name].filter(Boolean);
  return parts.length ? parts.join(" · ") : customer.email;
}

export type SubscriptionLine = {
  id: string;
  /** The line priced from the subscription's admin plan (at most one per quotation). */
  is_plan_line: boolean;
  product_id: string | null;
  variant_id: string | null;
  description: string;
  quantity: number;
  unit_price: Decimal;
  tax_rate: Decimal;
  subtotal: Decimal;
  tax_amount: Decimal;
  total: Decimal;
};

export type SubscriptionSummary = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  customer: CustomerSummary;
  plan_name: string;
  billing_frequency: BillingFrequency;
  start_date: string | null;
  expiry_date: string | null;
  next_billing_date: string | null;
  quotation_valid_until: string | null;
  /** Set when the customer declined the quotation (status is then CLOSED). */
  rejected_at: string | null;
  /** The admin plan the quotation was made from, or null for a custom plan. */
  plan_id: string | null;
  subtotal: Decimal;
  tax_total: Decimal;
  total: Decimal;
  created_at: string;
};

export type Subscription = SubscriptionSummary & {
  rejection_reason: string | null;
  paused_at: string | null;
  renewed_at: string | null;
  plan_rules: PlanRules | null;
  payment_terms_days: number;
  /** Default validity used when the quotation is sent. */
  quotation_validity_days: number;
  notes: string | null;
  quotation_sent_at: string | null;
  confirmed_at: string | null;
  activated_at: string | null;
  closed_at: string | null;
  updated_at: string;
  lines: SubscriptionLine[];
};

/**
 * A quotation line as sent to the API. Three kinds:
 * - plan line (`is_plan_line`): name and price come from the plan;
 * - catalog line (`product_id`, optional `variant_id`): defaults come from the product;
 * - free-text line: description and unit_price are required.
 * A null tax_rate means "use the tax that applies" (product tax, then the default tax).
 */
export type SubscriptionLineInput = {
  is_plan_line?: boolean;
  product_id?: string | null;
  variant_id?: string | null;
  description?: string | null;
  quantity: number;
  unit_price?: string | null;
  tax_rate?: string | null;
};

/**
 * Create body, also used for edits. On edit, leave `plan_id` out to keep the current
 * plan, or send null to switch to a custom plan.
 */
export type SubscriptionInput = {
  customer_id: string;
  plan_id?: string | null;
  plan_name: string | null;
  billing_frequency: BillingFrequency | null;
  payment_terms_days: number;
  quotation_validity_days: number;
  expiry_date: string | null;
  notes: string | null;
  lines: SubscriptionLineInput[];
};

export type InvoiceSummary = {
  id: string;
  number: string;
  status: InvoiceStatus;
  customer: CustomerSummary;
  subscription: { id: string; number: string; plan_name: string; status: SubscriptionStatus };
  invoice_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  subtotal: Decimal;
  /** Admin discount applied before tax; total = subtotal - discount_total + tax_total. */
  discount_total: Decimal;
  discount_name: string | null;
  tax_total: Decimal;
  total: Decimal;
  amount_paid: Decimal;
  amount_due: Decimal;
  is_overdue: boolean;
  sent_at: string | null;
};

export type InvoicePayment = {
  id: string;
  amount: Decimal;
  method: PaymentMethod;
  paid_on: string;
  reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
};

export type Invoice = InvoiceSummary & {
  confirmed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  lines: Omit<SubscriptionLine, "id" | "is_plan_line" | "product_id" | "variant_id">[];
  payments: InvoicePayment[];
};

export type Payment = InvoicePayment & {
  invoice_id: string;
  invoice_number: string;
  customer: CustomerSummary;
  customer_email: string;
};

export type StaffCustomerRow = {
  id: string;
  email: string;
  is_active: boolean;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  created_at: string;
  active_subscriptions: number;
  outstanding_amount: Decimal;
};

export type StaffCustomer = StaffCustomerRow & {
  address: string | null;
  profile_updated_at: string | null;
  subscriptions_total: number;
  open_quotations: number;
  invoiced_total: Decimal;
  paid_total: Decimal;
  overdue_amount: Decimal;
};

export type CustomerProfileInput = {
  full_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type ActivityItem = {
  at: string;
  kind:
    | "subscription_created"
    | "quotation_sent"
    | "quotation_accepted"
    | "quotation_rejected"
    | "subscription_activated"
    | "subscription_closed"
    | "invoice_generated"
    | "invoice_confirmed"
    | "invoice_paid"
    | "invoice_cancelled"
    | "payment_recorded";
  message: string;
  target: "subscription" | "invoice";
  target_id: string;
};

export type StaffDashboard = {
  as_of: string;
  date_from: string | null;
  date_to: string | null;
  total_customers: number;
  active_customers: number;
  recent_activity: ActivityItem[];
  active_subscriptions: number;
  open_quotations: number;
  awaiting_activation: number;
  revenue_received: Decimal;
  payments_count: number;
  outstanding_invoices: number;
  outstanding_amount: Decimal;
  overdue_invoices: number;
  overdue_amount: Decimal;
  draft_invoices: number;
};

export type BillingRunResult = {
  as_of: string;
  subscriptions_billed: number;
  invoices_created: number;
  invoice_numbers: string[];
};

type QueryValue = string | number | boolean | null | undefined;

function withQuery(path: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** A readable message for any error thrown by these calls. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422 && error.message.startsWith("Request failed")) {
      return "Some fields are invalid. Check the form and try again.";
    }
    if (error.status === 403) return "You don't have permission to do that.";
    return error.message;
  }
  return "Something went wrong. Check your connection and try again.";
}

// --- Subscriptions and quotations ---

export function listSubscriptions(params: {
  status?: SubscriptionStatus | "";
  search?: string;
  customer_id?: string;
  page?: number;
}) {
  return apiRequest<Page<SubscriptionSummary>>(withQuery("/api/staff/subscriptions", params));
}

export function getSubscription(id: string) {
  return apiRequest<Subscription>(`/api/staff/subscriptions/${encodeURIComponent(id)}`);
}

export function createSubscription(body: SubscriptionInput) {
  return apiRequest<Subscription>("/api/staff/subscriptions", { method: "POST", body });
}

export function updateSubscription(id: string, body: SubscriptionInput) {
  return apiRequest<Subscription>(`/api/staff/subscriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

export type SubscriptionAction =
  | { action: "send-quotation"; body: { valid_days: number } }
  | { action: "revert-to-draft" }
  | { action: "confirm" }
  | { action: "activate"; body: { start_date: string | null; expiry_date: string | null } }
  | { action: "close" }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "renew" };

/** What the subscription's admin plan allows. Null when it has no plan. */
export type PlanRules = {
  plan_id: string;
  minimum_quantity: number;
  allow_pause: boolean;
  allow_renewal: boolean;
  allow_early_closure: boolean;
  auto_close_on_expiry: boolean;
};

export function runSubscriptionAction(id: string, request: SubscriptionAction) {
  return apiRequest<Subscription>(
    `/api/staff/subscriptions/${encodeURIComponent(id)}/${request.action}`,
    { method: "POST", body: "body" in request ? request.body : {} },
  );
}

export function customerOptions(search: string) {
  return apiRequest<CustomerSummary[]>(
    withQuery("/api/staff/subscriptions/customer-options", { search, limit: 20 }),
  );
}

// --- Catalog for the quotation form ---

export type TaxRef = { id: string; name: string; rate: Decimal };

/** An admin plan that can be offered today. */
export type PlanOption = {
  id: string;
  name: string;
  description: string | null;
  price: Decimal;
  billing_frequency: BillingFrequency;
  minimum_quantity: number;
  allow_pause: boolean;
  allow_renewal: boolean;
  allow_early_closure: boolean;
  auto_close_on_expiry: boolean;
  product_ids: string[];
  /** The default tax, suggested for the plan line. */
  tax: TaxRef | null;
};

export type ProductOption = {
  id: string;
  name: string;
  product_type: string;
  sales_price: Decimal;
  description: string | null;
  /** The tax that applies (product, then product type, then the default). */
  tax: TaxRef | null;
  variants: { id: string; name: string; additional_price: Decimal; final_price: Decimal }[];
};

export type TaxOption = TaxRef & { is_default: boolean };

export function listPlanOptions() {
  return apiRequest<PlanOption[]>("/api/staff/catalog/plans");
}

export function listProductOptions() {
  return apiRequest<ProductOption[]>("/api/staff/catalog/products");
}

export function listTaxOptions() {
  return apiRequest<TaxOption[]>("/api/staff/taxes");
}

// --- Quotation templates ---

export type TemplateLine = Omit<SubscriptionLine, "subtotal" | "tax_amount">;

export type QuotationTemplate = {
  id: string;
  name: string;
  description: string | null;
  plan_id: string | null;
  plan_name: string;
  billing_frequency: BillingFrequency;
  validity_days: number;
  payment_terms_days: number;
  notes: string | null;
  is_active: boolean;
  total: Decimal;
  lines: TemplateLine[];
  updated_at: string;
};

export type TemplateInput = {
  name: string;
  description: string | null;
  plan_id: string | null;
  plan_name: string | null;
  billing_frequency: BillingFrequency | null;
  validity_days: number;
  payment_terms_days: number;
  notes: string | null;
  is_active: boolean;
  lines: SubscriptionLineInput[];
};

export function listTemplates(activeOnly = false) {
  return apiRequest<QuotationTemplate[]>(
    withQuery("/api/staff/quotation-templates", { active_only: activeOnly || undefined }),
  );
}

export function getTemplate(id: string) {
  return apiRequest<QuotationTemplate>(`/api/staff/quotation-templates/${encodeURIComponent(id)}`);
}

export function createTemplate(body: TemplateInput) {
  return apiRequest<QuotationTemplate>("/api/staff/quotation-templates", {
    method: "POST",
    body,
  });
}

/** Replaces the whole template. Quotations already made from it don't change. */
export function updateTemplate(id: string, body: TemplateInput) {
  return apiRequest<QuotationTemplate>(`/api/staff/quotation-templates/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
  });
}

export function deleteTemplate(id: string) {
  return apiRequest<void>(`/api/staff/quotation-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// --- Invoices and billing ---

export function listInvoices(params: {
  status?: InvoiceStatus | "";
  overdue?: boolean;
  search?: string;
  subscription_id?: string;
  customer_id?: string;
  page?: number;
}) {
  return apiRequest<Page<InvoiceSummary>>(withQuery("/api/staff/invoices", params));
}

export function getInvoice(id: string) {
  return apiRequest<Invoice>(`/api/staff/invoices/${encodeURIComponent(id)}`);
}

export function runInvoiceAction(id: string, action: "confirm" | "cancel" | "send") {
  return apiRequest<Invoice>(`/api/staff/invoices/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
  });
}

export function runBilling(asOf: string | null) {
  return apiRequest<BillingRunResult>("/api/staff/billing/run", {
    method: "POST",
    body: { as_of: asOf },
  });
}

// --- Payments ---

export function listPayments(params: {
  method?: PaymentMethod | "";
  date_from?: string;
  date_to?: string;
  invoice_id?: string;
  customer_id?: string;
  page?: number;
}) {
  return apiRequest<Page<Payment>>(withQuery("/api/staff/payments", params));
}

export function recordPayment(body: {
  invoice_id: string;
  amount: string;
  method: PaymentMethod;
  paid_on: string | null;
  reference: string | null;
  notes: string | null;
}) {
  return apiRequest<Payment>("/api/staff/payments", { method: "POST", body });
}

// --- Customers ---

export function listCustomers(params: { search?: string; page?: number }) {
  return apiRequest<Page<StaffCustomerRow>>(withQuery("/api/staff/customers", params));
}

export function getCustomer(id: string) {
  return apiRequest<StaffCustomer>(`/api/staff/customers/${encodeURIComponent(id)}`);
}

export function createCustomer(body: CustomerProfileInput & { email: string; password: string }) {
  return apiRequest<StaffCustomer>("/api/staff/customers", { method: "POST", body });
}

export function updateCustomer(id: string, body: CustomerProfileInput) {
  return apiRequest<StaffCustomer>(`/api/staff/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

// --- Account ---

/** Changes the signed-in staff member's password. Other sessions are signed out. */
export function changeStaffPassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>("/api/staff/account/password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

// --- Dashboard ---

export function getStaffDashboard(params: { date_from?: string; date_to?: string }) {
  return apiRequest<StaffDashboard>(withQuery("/api/staff/dashboard", params));
}
