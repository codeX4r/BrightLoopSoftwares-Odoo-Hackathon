"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Overview", exact: true },
  { href: "/portal/subscriptions", label: "My subscriptions", exact: false },
  { href: "/portal/invoices", label: "My invoices", exact: false },
  { href: "/portal/profile", label: "My profile", exact: false },
] as const;

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Customer portal sections" className="print:hidden">
      <p className="mb-3 px-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Customer portal
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
