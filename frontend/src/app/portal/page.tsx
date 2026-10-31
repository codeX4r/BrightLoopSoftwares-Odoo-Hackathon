"use client";

import { RoleGuard } from "@/components/auth/role-guard";

export default function CustomerPortalPage() {
  return (
    <RoleGuard role="CUSTOMER" title="Customer Portal">
      {(user) => (
        <p className="text-zinc-600">
          Welcome, <span className="font-medium text-zinc-900">{user.email}</span>.
        </p>
      )}
    </RoleGuard>
  );
}
