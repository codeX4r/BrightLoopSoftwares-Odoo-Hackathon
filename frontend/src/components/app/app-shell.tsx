"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/landing/brand-mark";
import { logout, type CurrentUser } from "@/lib/auth";

import { NAV_ICONS } from "./nav-icons";
import { activeItem, ROLE_LABEL, type NavGroup, type NavItem } from "./nav-config";

const PILL_SPRING = { type: "spring", duration: 0.5, bounce: 0.3 } as const;

/**
 * The signed-in frame for every role. It reuses the landing page language: warm paper,
 * the brightloop wordmark, a white pill that springs between nav items, mono labels.
 */
export function AppShell({
  user,
  groups,
  children,
}: {
  user: CurrentUser;
  groups: NavGroup[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes (adjusting state during render).
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const current = activeItem(groups, pathname);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-paper text-ink">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col p-3 lg:flex print:hidden">
          <Sidebar groups={groups} current={current} user={user} pillId="nav-pill-desktop" />
        </aside>

        {/* Mobile top bar + drawer */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/[0.06] bg-paper/85 px-4 backdrop-blur-xl lg:hidden print:hidden">
          <Link href={groups[0].items[0].href} className="flex items-center gap-2">
            <BrandMark className="size-7" />
            <span className="text-[18px] font-medium tracking-[-0.03em]">brightloop</span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="flex size-9 items-center justify-center rounded-[10px] hover:bg-black/5"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M4 8h16M4 16h16" />
            </svg>
          </button>
        </header>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-paper p-3 shadow-2xl [overscroll-behavior:contain]">
              <Sidebar groups={groups} current={current} user={user} pillId="nav-pill-mobile" />
            </div>
          </div>
        )}

        <div className="lg:pl-[256px]">
          <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">
            {children}
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}

function Sidebar({
  groups,
  current,
  user,
  pillId,
}: {
  groups: NavGroup[];
  current: NavItem | null;
  user: CurrentUser;
  pillId: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-[20px] border border-stone-line bg-stone/60">
      <div className="flex h-16 items-center gap-2 px-4">
        <Link href={groups[0].items[0].href} className="flex items-center gap-2" aria-label="Home">
          <BrandMark className="size-7" />
          <span className="text-[18px] font-medium tracking-[-0.03em]">brightloop</span>
        </Link>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 font-mono text-[11px] text-muted shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
          {ROLE_LABEL[user.role]}
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-4 [overscroll-behavior:contain]">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className={gi ? "mt-5" : "mt-1"}>
            {group.label && (
              <p className="mb-1.5 px-3 font-mono text-[11px] text-muted">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = current === item;
                return (
                  <li key={`${item.label}-${item.href}`}>
                    <Link
                      href={item.href}
                      title={item.note}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] transition-colors duration-150 ${
                        active ? "font-medium text-ink" : "text-ink/65 hover:bg-black/[0.03] hover:text-ink"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={pillId}
                          aria-hidden="true"
                          className="absolute inset-0 rounded-[10px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_1px_3px_rgb(0_0_0/0.08)]"
                          transition={PILL_SPRING}
                        />
                      )}
                      <span className={`relative size-[18px] shrink-0 ${active ? "text-loop" : ""}`}>
                        {NAV_ICONS[item.icon]}
                      </span>
                      <span className="relative truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <UserMenu user={user} />
    </div>
  );
}

function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setSigningOut(true);
    // The backend clears the cookie even for expired tokens; leave the page either way.
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div ref={ref} className="relative p-2">
      {open && (
        <div className="absolute right-2 bottom-[calc(100%-2px)] left-2 origin-bottom rounded-[14px] border border-transparent bg-white p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.2)]">
          <p className="truncate px-3 pt-2 pb-1 text-[13px] font-medium">{user.email}</p>
          <p className="px-3 pb-2 font-mono text-[11px] text-muted">{ROLE_LABEL[user.role]} account</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="w-full rounded-[10px] px-3 py-2 text-left text-[14px] text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left hover:bg-black/[0.03]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-white">
          {user.email.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{user.email}</span>
          <span className="block text-[12px] text-muted">Account and log out</span>
        </span>
        <svg viewBox="0 0 16 16" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="m5 10 3-3 3 3" />
        </svg>
      </button>
    </div>
  );
}

/** Centered brand mark while the session check runs, so the frame never flashes. */
export function ShellLoading({ label = "Checking your access…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper" aria-live="polite">
      <BrandMark className="size-10 animate-pulse motion-reduce:animate-none" />
      <p className="text-[14px] text-muted">{label}</p>
    </div>
  );
}

export function ShellError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper p-6 text-center">
      <BrandMark className="size-10" />
      <p role="alert" className="max-w-sm text-[15px] text-ink">
        {message}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="press rounded-[10px] bg-ink px-4 py-2 text-[14px] font-medium text-white hover:bg-black"
      >
        Reload
      </button>
    </div>
  );
}
