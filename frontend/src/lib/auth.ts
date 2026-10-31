import { apiRequest } from "@/lib/api";

export type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LoginResponse = {
  access_token: string; // Random session token. The browser keeps it in the HttpOnly cookie.
  token_type: "bearer";
  expires_in: number;
  user_id: string;
  email: string;
  role: Role;
};

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  STAFF: "/staff",
  CUSTOMER: "/portal",
};

/**
 * Signs in. The backend sets an HttpOnly cookie, so the token in the response body is
 * intentionally not stored anywhere in the browser.
 *
 * `selectedRole` must match the account's role or the backend rejects the login.
 * The returned role is the one stored in the database.
 */
export async function login(email: string, password: string, selectedRole: Role): Promise<Role> {
  const res = await apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password, role: selectedRole },
  });
  return res.role;
}

/**
 * Registers a new customer and signs them in (the backend sets the session cookie).
 * Signup always creates a CUSTOMER; admin and staff accounts are created by an admin.
 */
export async function signupCustomer(email: string, password: string): Promise<Role> {
  const res = await apiRequest<LoginResponse>("/api/auth/signup", {
    method: "POST",
    body: { email, password },
  });
  return res.role;
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>("/api/auth/me");
}

export function logout(): Promise<void> {
  return apiRequest<void>("/api/auth/logout", { method: "POST" });
}
