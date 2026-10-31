"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { getCurrentUser, ROLE_HOME, type CurrentUser, type Role } from "@/lib/auth";

export type RequireRoleState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: CurrentUser };

/**
 * Loads the signed-in user and checks the role the backend reports. Signed-out users go to
 * the login page; users with another role go to their own home page. The backend enforces
 * access on every API call, so this check only controls what the browser shows.
 */
export function useRequireRole(role: Role): RequireRoleState {
  const router = useRouter();
  const [state, setState] = useState<RequireRoleState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((me) => {
        if (cancelled) return;
        if (me.role !== role) {
          router.replace(ROLE_HOME[me.role]);
          return;
        }
        setState({ status: "ready", user: me });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setState({
          status: "error",
          message: "We couldn't load your account. Please refresh the page.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [role, router]);

  return state;
}
