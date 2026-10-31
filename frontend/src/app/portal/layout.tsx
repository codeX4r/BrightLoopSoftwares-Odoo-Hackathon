import { PortalShell } from "@/components/portal/portal-shell";

// The portal waits for a client-side session check before showing any page, so
// navigations into it are not instant by design. This opts /portal out of Next.js
// instant-navigation validation. `instant` can only be exported from a Server Component,
// which is why the client-side guard lives in PortalShell.
export const instant = false;

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
