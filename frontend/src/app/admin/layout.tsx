"use client";

import type { ReactNode } from "react";

import { AdminToastProvider } from "@/components/admin/toast-context";
import { AppShell, ShellError, ShellLoading } from "@/components/app/app-shell";
import { ADMIN_GROUPS } from "@/components/app/nav-config";
import { useRequireRole } from "@/lib/use-require-role";

/** Every page under /admin requires a signed-in user whose backend role is ADMIN. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const auth = useRequireRole("ADMIN");

  if (auth.status === "loading") return <ShellLoading />;
  if (auth.status === "error") return <ShellError message={auth.message} />;

  return (
    <AdminToastProvider>
      <AppShell user={auth.user} groups={ADMIN_GROUPS}>
        {children}
      </AppShell>
    </AdminToastProvider>
  );
}
