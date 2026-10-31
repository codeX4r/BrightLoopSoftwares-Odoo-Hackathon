"use client";

import { createContext, useContext } from "react";

import { AppShell } from "@/components/app/app-shell";
import { PORTAL_GROUPS } from "@/components/app/nav-config";
import { RoleGuard } from "@/components/auth/role-guard";
import type { CurrentUser } from "@/lib/auth";

const PortalUserContext = createContext<CurrentUser | null>(null);

/** The signed-in customer. Only usable inside the /portal layout. */
export function usePortalUser(): CurrentUser {
  const user = useContext(PortalUserContext);
  if (!user) throw new Error("usePortalUser must be used inside PortalShell");
  return user;
}

/** Customer-only frame for /portal: checks the session in the browser, then shows nav + page. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="CUSTOMER">
      {(user) => (
        <PortalUserContext.Provider value={user}>
          <AppShell user={user} groups={PORTAL_GROUPS}>
            {children}
          </AppShell>
        </PortalUserContext.Provider>
      )}
    </RoleGuard>
  );
}
