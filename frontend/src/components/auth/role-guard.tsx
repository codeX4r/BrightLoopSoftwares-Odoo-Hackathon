"use client";

import type { ReactNode } from "react";

import { ShellError, ShellLoading } from "@/components/app/app-shell";
import { type CurrentUser, type Role } from "@/lib/auth";
import { useRequireRole } from "@/lib/use-require-role";

type RoleGuardProps = {
  /** One role, or every role allowed in this area. */
  role: Role | readonly Role[];
  children: (user: CurrentUser) => ReactNode;
};

/**
 * Gate for the staff and customer areas: shows the branded loading screen while the
 * session is checked, then renders the area for the signed-in user. Signed-out users go
 * to the login page; users with another role go to their own home page.
 */
export function RoleGuard({ role, children }: RoleGuardProps) {
  const state = useRequireRole(role);
  if (state.status === "error") return <ShellError message={state.message} />;
  if (state.status === "loading") return <ShellLoading />;
  return <>{children(state.user)}</>;
}
