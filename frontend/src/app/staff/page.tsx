"use client";

import { RoleGuard } from "@/components/auth/role-guard";

export default function StaffDashboardPage() {
  return (
    <RoleGuard role="STAFF" title="Staff Dashboard">
      {(user) => (
        <p className="text-zinc-600">
          Signed in as <span className="font-medium text-zinc-900">{user.email}</span> (Staff).
        </p>
      )}
    </RoleGuard>
  );
}
