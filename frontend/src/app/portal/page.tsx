import PortalOverview from "./portal-overview";

// Portal pages load the customer's data in the browser after a session check, so they
// are not instant by design. `instant` must be exported from a Server Component.
export const instant = false;

export default function Page() {
  return <PortalOverview />;
}
