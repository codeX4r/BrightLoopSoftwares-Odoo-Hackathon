"use client";

import { createContext, useContext } from "react";

import { RoleGuard } from "@/components/auth/role-guard";
import { AppShell } from "@/components/app-shell";
import { PORTAL_NAV } from "@/components/portal/portal-nav";
import type { CurrentUser } from "@/lib/auth";

const PortalUserContext = createContext<CurrentUser | null>(null);

/** The signed-in customer. Only usable inside the /portal layout. */
export function usePortalUser(): CurrentUser {
  const user = useContext(PortalUserContext);
  if (!user) throw new Error("usePortalUser must be used inside PortalShell");
  return user;
}

/** Customer-only frame for /portal: checks the session in the browser, then shows the app frame. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="CUSTOMER">
      {(user) => (
        <PortalUserContext.Provider value={user}>
          <AppShell user={user} nav={PORTAL_NAV} navLabel="Customer portal navigation">
            {children}
          </AppShell>
        </PortalUserContext.Provider>
      )}
    </RoleGuard>
  );
}
