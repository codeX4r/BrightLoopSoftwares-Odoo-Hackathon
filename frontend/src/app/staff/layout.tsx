"use client";

import { AppShell } from "@/components/app/app-shell";
import { ADMIN_GROUPS, STAFF_GROUPS } from "@/components/app/nav-config";
import { RoleGuard } from "@/components/auth/role-guard";

/**
 * Staff panel. Admins use these screens too (the staff API allows them), and they keep
 * their admin sidebar here, so moving between admin and billing pages feels like one app.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role={["STAFF", "ADMIN"]}>
      {(user) => (
        <AppShell user={user} groups={user.role === "ADMIN" ? ADMIN_GROUPS : STAFF_GROUPS}>
          {children}
        </AppShell>
      )}
    </RoleGuard>
  );
}
