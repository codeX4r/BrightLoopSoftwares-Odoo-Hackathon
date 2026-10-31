export type AdminNavItem = {
  label: string;
  href: string;
  /** False for modules that have no backend yet. Their pages show a "not built yet" notice. */
  ready: boolean;
  note?: string;
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
  { label: "Quotations", href: "/admin/quotations", ready: false },
  { label: "Subscriptions", href: "/admin/subscriptions", ready: false },
  { label: "Invoices", href: "/admin/invoices", ready: false },
  { label: "Taxes", href: "/admin/taxes", ready: false },
  { label: "Discounts", href: "/admin/discounts", ready: false },
  { label: "Payments", href: "/admin/payments", ready: false },
  { label: "Reports", href: "/admin/reports", ready: false },
  { label: "Settings", href: "/admin/settings", ready: false },
];
