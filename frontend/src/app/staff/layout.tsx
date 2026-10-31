"use client";

import Link from "next/link";

import { RoleGuard } from "@/components/auth/role-guard";
import { StaffNav } from "@/components/staff/staff-nav";

/**
 * Staff panel. Admins can open it too (the staff API already allows them), so the admin
 * panel's Quotations, Subscriptions, Invoices and Payments links use these screens.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role={["STAFF", "ADMIN"]}>
      {(user) => (
        <>
          {user.role === "ADMIN" && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 print:hidden">
              <span>You are using the staff panel as an administrator.</span>
              <Link href="/admin" className="font-semibold text-indigo-700 hover:text-indigo-600">
                ← Back to admin panel
              </Link>
            </div>
          )}
          <div className="flex flex-col gap-8 lg:flex-row">
            <aside className="lg:w-56 lg:shrink-0 print:hidden">
              <StaffNav />
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </>
      )}
    </RoleGuard>
  );
}
