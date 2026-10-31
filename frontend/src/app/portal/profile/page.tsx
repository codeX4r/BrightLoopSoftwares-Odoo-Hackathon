import MyProfile from "./my-profile";

// Loaded in the browser after the session check; see app/portal/page.tsx.
export const instant = false;

export default function Page() {
  return <MyProfile />;
}
