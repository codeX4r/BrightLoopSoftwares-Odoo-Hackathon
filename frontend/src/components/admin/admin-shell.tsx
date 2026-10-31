"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ADMIN_NAV, type AdminNavItem } from "@/components/admin/nav";
import { type CurrentUser, logout } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Crumb = { label: string; href: string };

function labelForSegment(segment: string, href: string): string {
  if (UUID.test(segment)) return "Details";
  if (segment === "new") return "New";
  const navItem = ADMIN_NAV.find((item) => item.href === href);
  if (navItem) return navItem.label;
  if (segment === "product-types") return "Product Types";
  return segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function crumbsFor(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const crumbs: Crumb[] = [{ label: "Admin", href: "/admin" }];
  let href = "/admin";
  for (const part of parts) {
    href += `/${part}`;
    crumbs.push({ label: labelForSegment(part, href), href });
  }
  return crumbs;
}

/** Highlights only one sidebar entry: the most specific link that matches the path. */
function activeHref(pathname: string): string | null {
  const matches = ADMIN_NAV.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}

export function AdminShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<"profile" | "notifications" | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Close open menus and the mobile drawer when the route changes. Adjusting state during
  // render (instead of in an effect) avoids an extra render pass.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setMobileOpen(false);
    setMenu(null);
  }

  // Click outside a dropdown closes it.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) setMenu(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = activeHref(pathname);
  const crumbs = crumbsFor(pathname);

  async function handleLogout() {
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  const sidebar = (
    <nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
      {ADMIN_NAV.map((item) => (
        <SidebarLink
          key={`${item.label}-${item.href}`}
          item={item}
          active={current === item.href && item.label !== "Product Variants" && !item.staffPanel}
          collapsed={collapsed}
        />
      ))}
    </nav>
  );

  return (
    <div ref={shellRef} className="min-h-screen bg-zinc-100 font-sans">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-zinc-900 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-4">
          {collapsed ? <LogoMark /> : <BrandLogo tone="light" />}
        </div>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-zinc-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-zinc-900">
            <div className="flex h-16 items-center border-b border-white/10 px-4">
              <BrandLogo tone="light" />
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
          >
            <MenuIcon />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:block"
          >
            <MenuIcon />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-2 truncate text-sm">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={crumb.href} className="flex min-w-0 items-center gap-2">
                    {index > 0 && <span className="text-zinc-300">/</span>}
                    {last ? (
                      <span className="truncate font-semibold text-zinc-900" aria-current="page">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="truncate text-zinc-500 hover:text-zinc-800"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={menu === "notifications"}
              onClick={() => setMenu(menu === "notifications" ? null : "notifications")}
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
            >
              <BellIcon />
            </button>
            {menu === "notifications" && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
                <p className="text-sm font-semibold text-zinc-900">Notifications</p>
                <p className="mt-2 text-sm text-zinc-500">
                  No notifications yet. Alerts such as overdue invoices will appear here once
                  billing is built.
                </p>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={menu === "profile"}
              onClick={() => setMenu(menu === "profile" ? null : "profile")}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {user.email.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-zinc-900">Administrator</span>
                <span className="block text-xs text-zinc-500">{user.email}</span>
              </span>
            </button>
            {menu === "profile" && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                <div className="border-b border-zinc-100 px-4 pb-3">
                  <p className="truncate text-sm font-medium text-zinc-900">{user.email}</p>
                  <p className="text-xs text-zinc-500">Role: {user.role}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";
  const tone = active
    ? "bg-white/10 text-white"
    : item.ready
      ? "text-zinc-300 hover:bg-white/5 hover:text-white"
      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300";
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : item.note}
      aria-current={active ? "page" : undefined}
      className={`${base} ${tone}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-xs font-semibold">
        {item.label.charAt(0)}
      </span>
      {!collapsed && (
        <span className="flex-1 truncate">
          {item.label}
          {!item.ready && <span className="ml-2 text-[10px] text-zinc-500 uppercase">soon</span>}
          {item.staffPanel && (
            <span className="ml-2 text-[10px] text-zinc-500 uppercase">staff panel</span>
          )}
        </span>
      )}
    </Link>
  );
}

function LogoMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
      B
    </span>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" strokeLinejoin="round" />
      <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}
