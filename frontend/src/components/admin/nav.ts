export type AdminNavItem = {
  label: string;
  href: string;
  /** False for modules that have no backend yet. Their pages show a "not built yet" notice. */
  ready: boolean;
  note?: string;
  /** Opens the staff panel (shared screens), which admins can use too. */
  staffPanel?: boolean;
};

/** Sidebar order follows the admin brief. */
export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", ready: true },
  { label: "Products", href: "/admin/products", ready: true },
  {
    label: "Product Variants",
    href: "/admin/products",
    ready: true,
    note: "Variants are managed inside each product.",
  },
  { label: "Subscription Plans", href: "/admin/plans", ready: true },
  { label: "Customers", href: "/admin/customers", ready: true },
  { label: "Staff Management", href: "/admin/staff", ready: true },
  {
    label: "Quotations",
    href: "/staff/subscriptions",
    ready: true,
    staffPanel: true,
    note: "Quotations are subscriptions in Draft or Quotation status.",
  },
  { label: "Subscriptions", href: "/staff/subscriptions", ready: true, staffPanel: true },
  { label: "Invoices", href: "/staff/invoices", ready: true, staffPanel: true },
  { label: "Taxes", href: "/admin/taxes", ready: true },
  { label: "Discounts", href: "/admin/discounts", ready: true },
  { label: "Payments", href: "/staff/payments", ready: true, staffPanel: true },
  { label: "Reports", href: "/admin/reports", ready: true },
  { label: "Settings", href: "/admin/settings", ready: true },
];
