import StaffAccount from "./staff-account";

// The staff layout checks the session in the browser before rendering any page, so this
// page can't be prerendered for instant navigation. `instant` must be exported from a
// Server Component, which is why the form lives in staff-account.tsx.
export const instant = false;

export default function Page() {
  return <StaffAccount />;
}
