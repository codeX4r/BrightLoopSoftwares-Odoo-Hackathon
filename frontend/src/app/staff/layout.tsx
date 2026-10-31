"use client";

import { RoleGuard } from "@/components/auth/role-guard";
import { StaffNav } from "@/components/staff/staff-nav";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="STAFF">
      {() => (
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="lg:w-56 lg:shrink-0 print:hidden">
            <StaffNav />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      )}
    </RoleGuard>
  );
}
