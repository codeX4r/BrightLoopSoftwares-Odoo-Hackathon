import type { NavItem } from "@/components/app-shell";

/** Staff sidebar. Admins using the staff screens see the admin sidebar instead. */
export const STAFF_NAV: NavItem[] = [
  { label: "Dashboard", href: "/staff", ready: true },
  { label: "Customers", href: "/staff/customers", ready: true },
  { label: "Quotations & subscriptions", href: "/staff/subscriptions", ready: true },
  { label: "Quotation templates", href: "/staff/templates", ready: true },
  { label: "Invoices", href: "/staff/invoices", ready: true },
  { label: "Payments", href: "/staff/payments", ready: true },
  { label: "Account", href: "/staff/account", ready: true },
];
