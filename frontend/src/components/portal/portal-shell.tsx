"use client";

import { createContext, useContext } from "react";

import { RoleGuard } from "@/components/auth/role-guard";
import { PortalNav } from "@/components/portal/portal-nav";
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
          <div className="flex flex-col gap-8 lg:flex-row">
            <aside className="lg:w-56 lg:shrink-0 print:hidden">
              <PortalNav />
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </PortalUserContext.Provider>
      )}
    </RoleGuard>
  );
}
