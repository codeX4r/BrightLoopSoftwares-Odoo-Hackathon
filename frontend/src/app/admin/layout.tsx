"use client";

import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminToastProvider } from "@/components/admin/toast-context";
import { RoleGuard } from "@/components/auth/role-guard";

/** Every page under /admin requires a signed-in user whose backend role is ADMIN. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="ADMIN">
      {(user) => (
        <AdminToastProvider>
          <AdminShell user={user}>{children}</AdminShell>
        </AdminToastProvider>
      )}
    </RoleGuard>
  );
}
