"use client";

import { ADMIN_NAV } from "@/components/admin/nav";
import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/auth/role-guard";
import { STAFF_NAV } from "@/components/staff/staff-nav";

/**
 * Staff panel. Admins can open it too (the staff API already allows them), so the admin
 * panel's Quotations, Subscriptions, Invoices and Payments links use these screens. Admins
 * keep their own sidebar here, so they can go back to any admin screen in one click.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role={["STAFF", "ADMIN"]}>
      {(user) => (
        <AppShell
          user={user}
          nav={user.role === "ADMIN" ? ADMIN_NAV : STAFF_NAV}
          navLabel={user.role === "ADMIN" ? "Admin navigation" : "Staff navigation"}
        >
          {children}
        </AppShell>
      )}
    </RoleGuard>
  );
}
