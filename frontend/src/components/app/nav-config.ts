import type { Role } from "@/lib/auth";

export type NavIcon =
  | "home"
  | "box"
  | "layers"
  | "repeat"
  | "users"
  | "badge"
  | "quote"
  | "invoice"
  | "percent"
  | "tag"
  | "wallet"
  | "chart"
  | "gear"
  | "user"
  | "key";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Match only the exact path (for section home pages). */
  exact?: boolean;
  /** A second entry that points at another item's page. Never shown as active. */
  alias?: boolean;
  /** Shown as a tooltip. */
  note?: string;
};

export type NavGroup = { label?: string; items: NavItem[] };

/** Admin sidebar. Keeps every entry from the admin brief, grouped by job. */
export const ADMIN_GROUPS: NavGroup[] = [
  { items: [{ label: "Dashboard", href: "/admin", icon: "home", exact: true }] },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: "box" },
      {
        label: "Product variants",
        href: "/admin/products",
        icon: "layers",
        alias: true,
        note: "Variants are managed inside each product.",
      },
      { label: "Subscription plans", href: "/admin/plans", icon: "repeat" },
      { label: "Taxes", href: "/admin/taxes", icon: "percent" },
      { label: "Discounts", href: "/admin/discounts", icon: "tag" },
    ],
  },
  {
    label: "Billing",
    items: [
      {
        label: "Quotations",
        href: "/staff/subscriptions",
        icon: "quote",
        alias: true,
        note: "Quotations are subscriptions in Draft or Quotation status.",
      },
      { label: "Subscriptions", href: "/staff/subscriptions", icon: "repeat" },
      { label: "Invoices", href: "/staff/invoices", icon: "invoice" },
      { label: "Payments", href: "/staff/payments", icon: "wallet" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Customers", href: "/admin/customers", icon: "users" },
      { label: "Staff", href: "/admin/staff", icon: "badge" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/admin/reports", icon: "chart" },
      { label: "Settings", href: "/admin/settings", icon: "gear" },
    ],
  },
];

export const STAFF_GROUPS: NavGroup[] = [
  { items: [{ label: "Dashboard", href: "/staff", icon: "home", exact: true }] },
  {
    label: "Billing",
    items: [
      { label: "Quotations & subscriptions", href: "/staff/subscriptions", icon: "quote" },
      { label: "Invoices", href: "/staff/invoices", icon: "invoice" },
      { label: "Payments", href: "/staff/payments", icon: "wallet" },
    ],
  },
  {
    label: "People",
    items: [{ label: "Customers", href: "/staff/customers", icon: "users" }],
  },
  {
    label: "You",
    items: [{ label: "Account", href: "/staff/account", icon: "key" }],
  },
];

export const PORTAL_GROUPS: NavGroup[] = [
  { items: [{ label: "Overview", href: "/portal", icon: "home", exact: true }] },
  {
    label: "Billing",
    items: [
      { label: "My subscriptions", href: "/portal/subscriptions", icon: "repeat" },
      { label: "My invoices", href: "/portal/invoices", icon: "invoice" },
    ],
  },
  {
    label: "You",
    items: [
      { label: "My profile", href: "/portal/profile", icon: "user" },
      { label: "Account", href: "/portal/account", icon: "key" },
    ],
  },
];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

/** The single most specific non-alias item that matches the current path. */
export function activeItem(groups: NavGroup[], pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.alias) continue;
      const hit = item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (hit && (!best || item.href.length > best.href.length)) best = item;
    }
  }
  return best;
}
