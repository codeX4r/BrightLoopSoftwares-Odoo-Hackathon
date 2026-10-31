"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ApiError } from "@/lib/api";
import { getCurrentUser, logout, ROLE_HOME, type CurrentUser, type Role } from "@/lib/auth";

type RoleGuardProps = {
  role: Role;
  title: string;
  children: (user: CurrentUser) => ReactNode;
};

/**
 * Client-side gate for role-specific areas. It only decides what UI to show; the backend
 * enforces access on every API call regardless of what the browser does.
 */
export function RoleGuard({ role, title, children }: RoleGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((me) => {
        if (cancelled) return;
        if (me.role !== role) {
          router.replace(ROLE_HOME[me.role]);
          return;
        }
        setUser(me);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError("We couldn't load your account. Please refresh the page.");
      });
    return () => {
      cancelled = true;
    };
  }, [role, router]);

  async function handleLogout() {
    setSigningOut(true);
    // The backend clears the cookie even for expired tokens; leave the page either way.
    await logout().catch(() => undefined);
    router.replace("/login");
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 font-sans">
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
        <p className="text-sm text-zinc-500" aria-live="polite">
          Loading…
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white">
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        <div className="mt-6">{children(user)}</div>
      </main>
    </div>
  );
}
