"use client";

import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminToastProvider } from "@/components/admin/toast-context";
import { LoadingState } from "@/components/ui/feedback";
import { useRequireRole } from "@/lib/use-require-role";

/** Every page under /admin requires a signed-in user whose backend role is ADMIN. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const auth = useRequireRole("ADMIN");

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <LoadingState label="Checking your access…" />
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <p role="alert" className="text-sm text-red-700">
          {auth.message}
        </p>
      </div>
    );
  }

  return (
    <AdminToastProvider>
      <AdminShell user={auth.user}>{children}</AdminShell>
    </AdminToastProvider>
  );
}
