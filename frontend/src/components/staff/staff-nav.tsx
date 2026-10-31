"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/staff", label: "Dashboard", exact: true },
  { href: "/staff/subscriptions", label: "Quotations & subscriptions", exact: false },
  { href: "/staff/invoices", label: "Invoices", exact: false },
  { href: "/staff/payments", label: "Payments", exact: false },
  { href: "/staff/account", label: "Account", exact: false },
] as const;

export function StaffNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff sections" className="print:hidden">
      <p className="mb-3 px-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Staff panel
      </p>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
