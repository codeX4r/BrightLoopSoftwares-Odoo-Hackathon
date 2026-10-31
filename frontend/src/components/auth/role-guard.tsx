"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { type CurrentUser, type Role, logout } from "@/lib/auth";
import { useRequireRole } from "@/lib/use-require-role";

type RoleGuardProps = {
  role: Role;
  /** Page heading. Omit when the children render their own headings. */
  title?: string;
  children: (user: CurrentUser) => ReactNode;
};

/**
 * Page-level gate for the staff and customer areas. The admin area uses its own shell
 * with the same role check from useRequireRole.
 */
export function RoleGuard({ role, title, children }: RoleGuardProps) {
  const router = useRouter();
  const state = useRequireRole(role);
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    // The backend clears the cookie even for expired tokens; leave the page either way.
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  if (state.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 font-sans">
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
        <p className="text-sm text-zinc-500" aria-live="polite">
          Loading…
        </p>
      </main>
    );
  }

  const user = state.user;
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-600 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        {title ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            <div className="mt-6">{children(user)}</div>
          </>
        ) : (
          children(user)
        )}
      </main>
    </div>
  );
}
