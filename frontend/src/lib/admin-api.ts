/**
 * Typed calls to the admin catalog API. Money fields arrive as strings with two decimals
 * (for example "2560.00") and are displayed as-is or with formatINR.
 */
import { apiRequest } from "@/lib/api";
import type {
  BillingFrequency,
  InvoiceSummary,
  Page as StaffPage,
  StaffDashboard,
  SubscriptionSummary,
} from "@/lib/staff-api";

export type ProductStatus = "ACTIVE" | "ARCHIVED";
export type PlanStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
// Same enum as the staff API (one backend type, billing_frequency).
export type { BillingFrequency } from "@/lib/staff-api";

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type ProductType = { id: string; name: string };

export type Product = {
  id: string;
  name: string;
  product_type: ProductType;
  sales_price: string;
  cost_price: string;
  description: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  name: string;
  product_type_id: string;
  sales_price: string;
  cost_price: string;
  description: string | null;
  status: ProductStatus;
};

export type Variant = {
  id: string;
  product_id: string;
  name: string;
  additional_price: string;
  /** Calculated by the server: product sales price plus additional price. */
  final_price: string;
  description: string | null;
  status: ProductStatus;
};

export type VariantInput = {
  name: string;
  additional_price: string;
  description: string | null;
  status: ProductStatus;
};

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  billing_frequency: BillingFrequency;
  minimum_quantity: number;
  available_from: string;
  available_until: string | null;
  auto_close_on_expiry: boolean;
  allow_early_closure: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  status: PlanStatus;
  product_ids: string[];
  /** True when new customers can subscribe today. */
  is_offerable: boolean;
};

export type PlanInput = {
  name: string;
  description: string | null;
  product_ids: string[];
  price: string;
  billing_frequency: BillingFrequency;
  minimum_quantity: number;
  available_from: string;
  available_until: string | null;
  auto_close_on_expiry: boolean;
  allow_early_closure: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  status: PlanStatus;
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export { FREQUENCY_LABEL } from "@/lib/format";

type QueryValue = string | number | boolean | null | undefined;

/** Builds a query string, skipping empty values and `false` flags. */
function query(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type ProductFilters = {
  q?: string;
  status?: ProductStatus;
  product_type_id?: string;
  limit?: number;
  offset?: number;
};

export type PlanFilters = {
  q?: string;
  status?: PlanStatus;
  billing_frequency?: BillingFrequency;
  offerable?: boolean;
  limit?: number;
  offset?: number;
};

export const adminApi = {
  listProductTypes: () => apiRequest<ProductType[]>("/api/admin/product-types"),
  createProductType: (name: string) =>
    apiRequest<ProductType>("/api/admin/product-types", { method: "POST", body: { name } }),

  listProducts: (filters: ProductFilters) =>
    apiRequest<Page<Product>>(`/api/admin/products${query({ ...filters })}`),
  getProduct: (id: string) => apiRequest<Product>(`/api/admin/products/${id}`),
  createProduct: (input: ProductInput) =>
    apiRequest<Product>("/api/admin/products", { method: "POST", body: input }),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    apiRequest<Product>(`/api/admin/products/${id}`, { method: "PATCH", body: input }),
  deleteProduct: (id: string) =>
    apiRequest<void>(`/api/admin/products/${id}`, { method: "DELETE" }),

  listVariants: (productId: string) =>
    apiRequest<Variant[]>(`/api/admin/products/${productId}/variants`),
  createVariant: (productId: string, input: VariantInput) =>
    apiRequest<Variant>(`/api/admin/products/${productId}/variants`, {
      method: "POST",
      body: input,
    }),
  updateVariant: (id: string, input: Partial<VariantInput>) =>
    apiRequest<Variant>(`/api/admin/variants/${id}`, { method: "PATCH", body: input }),
  deleteVariant: (id: string) =>
    apiRequest<void>(`/api/admin/variants/${id}`, { method: "DELETE" }),

  listPlans: (filters: PlanFilters) =>
    apiRequest<Page<Plan>>(`/api/admin/plans${query({ ...filters })}`),
  getPlan: (id: string) => apiRequest<Plan>(`/api/admin/plans/${id}`),
  createPlan: (input: PlanInput) =>
    apiRequest<Plan>("/api/admin/plans", { method: "POST", body: input }),
  updatePlan: (id: string, input: Partial<PlanInput>) =>
    apiRequest<Plan>(`/api/admin/plans/${id}`, { method: "PATCH", body: input }),
};

// --- Customers and staff -----------------------------------------------------

export type AccountRole = "ADMIN" | "STAFF" | "CUSTOMER";

type Account = {
  id: string;
  email: string;
  role: AccountRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerFigures = {
  subscriptions_total: number;
  active_subscriptions: number;
  /** Confirmed or paid invoices only; drafts and cancelled invoices don't count. */
  invoices_total: number;
  invoiced_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  overdue_invoices: number;
};

export type StaffFigures = {
  subscriptions_created: number;
  payments_recorded: number;
  payments_amount: string;
};

export type PaymentBrief = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  customer_email: string;
  amount: string;
  method: string;
  paid_on: string;
};

/** Name fields come from the profile and are null until someone fills them in. */
export type CustomerRow = Account & {
  figures: CustomerFigures;
  full_name: string | null;
  company_name: string | null;
};
export type StaffRow = Account & {
  figures: StaffFigures;
  full_name: string | null;
  phone: string | null;
};
export type CustomerDetail = CustomerRow & { recent_payments: PaymentBrief[] };
export type StaffDetail = StaffRow & { recent_payments: PaymentBrief[] };

export type AccountFilters = {
  q?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export type NewAccountInput = { email: string; password: string };

/** is_active=false must reach the API, so it can't go through `query` (which skips false). */
function accountQuery(filters: AccountFilters): string {
  const { is_active, ...rest } = filters;
  const base = query({ ...rest });
  if (is_active === undefined) return base;
  return `${base}${base ? "&" : "?"}is_active=${is_active}`;
}

export const peopleApi = {
  listCustomers: (filters: AccountFilters) =>
    apiRequest<Page<CustomerRow>>(`/api/admin/customers${accountQuery(filters)}`),
  getCustomer: (id: string) => apiRequest<CustomerDetail>(`/api/admin/customers/${id}`),
  createCustomer: (input: NewAccountInput) =>
    apiRequest<CustomerRow>("/api/admin/customers", { method: "POST", body: input }),

  listStaff: (filters: AccountFilters) =>
    apiRequest<Page<StaffRow>>(`/api/admin/staff${accountQuery(filters)}`),
  getStaff: (id: string) => apiRequest<StaffDetail>(`/api/admin/staff/${id}`),
  /** Existing admin-only endpoint for staff creation. */
  createStaff: (input: NewAccountInput) =>
    apiRequest<Account>("/api/users/staff", { method: "POST", body: input }),

  /** Existing admin-only endpoint; works for customers and staff. */
  setActive: (id: string, isActive: boolean) =>
    apiRequest<Account>(`/api/users/${id}/status`, {
      method: "PATCH",
      body: { is_active: isActive },
    }),

  // A customer's history, from the staff API (admins are allowed there).
  customerSubscriptions: (customerId: string, page: number) =>
    apiRequest<StaffPage<SubscriptionSummary>>(
      `/api/staff/subscriptions${query({ customer_id: customerId, page, page_size: 10 })}`,
    ),
  customerInvoices: (customerId: string, page: number) =>
    apiRequest<StaffPage<InvoiceSummary>>(
      `/api/staff/invoices${query({ customer_id: customerId, page, page_size: 10 })}`,
    ),

  /** Business figures for the admin dashboard, from the staff dashboard API. */
  businessOverview: () => apiRequest<StaffDashboard>("/api/staff/dashboard"),
};
