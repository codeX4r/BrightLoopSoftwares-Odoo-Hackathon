"use client";

import type { ReactNode } from "react";

import { ADMIN_NAV } from "@/components/admin/nav";
import { AppShell } from "@/components/app-shell";
import type { CurrentUser } from "@/lib/auth";

/** The admin area: the shared app frame with the admin links. */
export function AdminShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <AppShell user={user} nav={ADMIN_NAV} navLabel="Admin navigation">
      {children}
    </AppShell>
  );
}
