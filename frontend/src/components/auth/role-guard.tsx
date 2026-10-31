"use client";

import type { ReactNode } from "react";

import { LoadingState } from "@/components/ui/feedback";
import { type CurrentUser, type Role } from "@/lib/auth";
import { useRequireRole } from "@/lib/use-require-role";

type RoleGuardProps = {
  /** One role, or every role allowed in this area. */
  role: Role | readonly Role[];
  children: (user: CurrentUser) => ReactNode;
};

/**
 * Area-level gate used by the admin, staff and customer layouts. Shows a loading or error
 * screen until the session check passes, then renders the children with the user.
 */
export function RoleGuard({ role, children }: RoleGuardProps) {
  const state = useRequireRole(role);

  if (state.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 font-sans">
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 font-sans">
        <LoadingState label="Checking your access…" />
      </main>
    );
  }

  return <>{children(state.user)}</>;
}
