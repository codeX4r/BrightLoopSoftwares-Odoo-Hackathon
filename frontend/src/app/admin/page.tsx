"use client";

import { RoleGuard } from "@/components/auth/role-guard";

export default function AdminDashboardPage() {
  return (
    <RoleGuard role="ADMIN" title="Admin Dashboard">
      {(user) => (
        <p className="text-zinc-600">
          Signed in as <span className="font-medium text-zinc-900">{user.email}</span> (Admin).
        </p>
      )}
    </RoleGuard>
  );
}
