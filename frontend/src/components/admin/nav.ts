import type { NavItem } from "@/components/app-shell";

/** Sidebar order follows the admin brief. */
export const ADMIN_NAV: NavItem[] = [
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
  {
    label: "Templates",
    href: "/staff/templates",
    ready: true,
    staffPanel: true,
    note: "Quotation templates: reusable plans, terms and lines.",
  },
  { label: "Invoices", href: "/staff/invoices", ready: true, staffPanel: true },
  { label: "Taxes", href: "/admin/taxes", ready: true },
  { label: "Discounts", href: "/admin/discounts", ready: true },
  { label: "Payments", href: "/staff/payments", ready: true, staffPanel: true },
  { label: "Reports", href: "/admin/reports", ready: true },
  { label: "Settings", href: "/admin/settings", ready: true },
];
