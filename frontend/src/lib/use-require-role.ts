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
 *
 * `role` may be one role or a list of allowed roles.
 */
export function useRequireRole(role: Role | readonly Role[]): RequireRoleState {
  // A stable key, so passing a new array literal on each render doesn't refetch.
  const allowedKey = (Array.isArray(role) ? role : [role]).join(",");
  const router = useRouter();
  const [state, setState] = useState<RequireRoleState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((me) => {
        if (cancelled) return;
        if (!allowedKey.split(",").includes(me.role)) {
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
  }, [allowedKey, router]);

  return state;
}
