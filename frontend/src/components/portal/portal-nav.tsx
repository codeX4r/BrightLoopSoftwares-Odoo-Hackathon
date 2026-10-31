import type { NavItem } from "@/components/app-shell";

export const PORTAL_NAV: NavItem[] = [
  { label: "Overview", href: "/portal", ready: true },
  { label: "My subscriptions", href: "/portal/subscriptions", ready: true },
  { label: "My invoices", href: "/portal/invoices", ready: true },
  { label: "My profile", href: "/portal/profile", ready: true },
  { label: "Account", href: "/portal/account", ready: true },
];
