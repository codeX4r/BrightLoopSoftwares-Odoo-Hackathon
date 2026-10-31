"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { type CurrentUser, logout } from "@/lib/auth";

/** One sidebar entry. */
export type NavItem = {
  label: string;
  href: string;
  /** False for modules that have no backend yet. Their pages show a "not built yet" notice. */
  ready: boolean;
  note?: string;
  /** Opens the staff panel (shared screens), which admins can use too. */
  staffPanel?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Breadcrumb root for each area, by the first path segment. */
const AREA_LABEL: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  portal: "Customer portal",
};

const SEGMENT_LABEL: Record<string, string> = {
  new: "New",
  "product-types": "Product Types",
};

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  ADMIN: "Administrator",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

type Crumb = { label: string; href: string };

function crumbsFor(pathname: string, nav: NavItem[]): Crumb[] {
  const [area, ...parts] = pathname.split("/").filter(Boolean);
  if (!area) return [];
  let href = `/${area}`;
  const crumbs: Crumb[] = [{ label: AREA_LABEL[area] ?? area, href }];
  for (const part of parts) {
    href += `/${part}`;
    const label = UUID.test(part)
      ? "Details"
      : (SEGMENT_LABEL[part] ??
        nav.find((item) => item.href === href)?.label ??
        part.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));
    crumbs.push({ label, href });
  }
  return crumbs;
}

/**
 * The sidebar entry to highlight: the most specific link that matches the path. When
 * several entries share that link, only the first one is highlighted.
 */
function activeItem(pathname: string, nav: NavItem[]): NavItem | null {
  let best: NavItem | null = null;
  for (const item of nav) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

/**
 * The frame for every signed-in area (admin, staff and customer portal): a dark sidebar
 * with the area's links, and a top bar with breadcrumbs and the account menu. Hidden
 * when printing, so quotations and invoices print on their own.
 */
export function AppShell({
  user,
  nav,
  navLabel,
  children,
}: {
  user: CurrentUser;
  nav: NavItem[];
  /** Accessible name of the sidebar, e.g. "Staff navigation". */
  navLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu and the mobile drawer when the route changes. Adjusting state during
  // render (instead of in an effect) avoids an extra render pass.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setMobileOpen(false);
    setMenuOpen(false);
  }

  // Click outside the account menu closes it.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = activeItem(pathname, nav);
  const crumbs = crumbsFor(pathname, nav);

  async function handleLogout() {
    setSigningOut(true);
    // The backend clears the cookie even for expired tokens; leave the page either way.
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  const sidebar = (
    <nav aria-label={navLabel} className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
      {nav.map((item) => (
        <SidebarLink
          key={`${item.label}-${item.href}`}
          item={item}
          active={item === current}
          collapsed={collapsed}
        />
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-100 font-sans print:bg-white">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-zinc-900 transition-[width] duration-200 lg:flex print:hidden ${
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
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
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

      <div
        className={`transition-[padding] duration-200 print:pl-0 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6 print:hidden">
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

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {user.email.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-zinc-900">
                  {ROLE_LABEL[user.role]}
                </span>
                <span className="block text-xs text-zinc-500">{user.email}</span>
              </span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
                <div className="border-b border-zinc-100 px-4 pb-3">
                  <p className="truncate text-sm font-medium text-zinc-900">{user.email}</p>
                  <p className="text-xs text-zinc-500">Role: {ROLE_LABEL[user.role]}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="mt-1 w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
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
