"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  authInput,
  authInputState,
  authSubmit,
  EyeToggle,
  FormError,
  Spinner,
} from "@/components/auth/auth-frame";
import { RoleSwitch } from "@/components/auth/role-switch";
import { ApiError } from "@/lib/api";
import { getCurrentUser, login, ROLE_HOME, type Role } from "@/lib/auth";

type FieldErrors = { role?: string; email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_ROLE_KEY = "brightloop:last-role";

const ROLE_HINT: Record<Role, string> = {
  CUSTOMER: "See your subscriptions, quotations and invoices.",
  STAFF: "Manage customers, quotations, invoices and payments.",
  ADMIN: "Set up the catalog, taxes, discounts, staff and reports.",
};

/** Seeded local accounts from the readme. Shown only in development builds. */
const DEMO_ACCOUNTS: { role: Role; email: string; password: string }[] =
  process.env.NODE_ENV === "development"
    ? [
        { role: "CUSTOMER", email: "customer@brightloop.com", password: "Customer@123" },
        { role: "STAFF", email: "staff@brightloop.com", password: "Staff@123456" },
        { role: "ADMIN", email: "admin@brightloop.com", password: "Admin@123456" },
      ]
    : [];

function validate(role: Role | "", email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!role) errors.role = "Choose how you use Brightloop.";
  if (!email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  else if (password.length > 128) errors.password = "Password is too long.";
  return errors;
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "That email, password and role don't match. Check that the right role is selected.";
    if (error.status === 429) {
      const minutes = error.retryAfterSeconds ? Math.ceil(error.retryAfterSeconds / 60) : null;
      return minutes
        ? `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
        : "Too many failed attempts. Try again later.";
    }
    if (error.status === 422) return "Check your email and password and try again.";
    return "Something went wrong on our side. Try again in a moment.";
  }
  return "Can't reach the server. Check your connection and try again.";
}

function readLastRole(): Role | "" {
  try {
    const saved = window.localStorage.getItem(LAST_ROLE_KEY);
    return saved === "ADMIN" || saved === "STAFF" || saved === "CUSTOMER" ? saved : "";
  } catch {
    return "";
  }
}

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Go straight to the right home page. Otherwise preselect the role
  // used last time on this device, so returning users only type their password.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) router.replace(ROLE_HOME[user.role]);
      })
      .catch(() => {
        if (!cancelled) setRole((current) => current || readLastRole());
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function chooseRole(next: Role) {
    setRole(next);
    setFieldErrors((e) => ({ ...e, role: undefined }));
  }

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(role, email, password);
    setFieldErrors(errors);
    setFormError(null);
    if (!role || errors.email || errors.password) {
      const first = errors.role ? null : errors.email ? "email" : "password";
      if (first) document.getElementById(first)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // The backend checks the selected role against the account and returns the real
      // role from the database; redirect on that, not on the selected value.
      const accountRole = await login(email.trim(), password, role);
      try {
        window.localStorage.setItem(LAST_ROLE_KEY, accountRole);
      } catch {
        // Storage can be blocked; remembering the role is only a convenience.
      }
      router.replace(ROLE_HOME[accountRole]);
    } catch (error) {
      setFormError(loginErrorMessage(error));
      setPassword("");
      setSubmitting(false);
      document.getElementById("password")?.focus();
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <FormError>{formError}</FormError>}

      <div>
        <p id="role-label" className="mb-2 text-[14px] font-medium">
          I&rsquo;m logging in as
        </p>
        <RoleSwitch
          value={role}
          onChange={chooseRole}
          disabled={submitting}
          invalid={Boolean(fieldErrors.role)}
          describedBy="role-help"
        />
        <p
          id="role-help"
          className={`mt-2 text-[13px] ${fieldErrors.role ? "text-red-600" : "text-muted"}`}
        >
          {fieldErrors.role ?? (role ? ROLE_HINT[role] : "Staff and admin accounts come from your admin.")}
        </p>
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-[14px] font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className={`${authInput} ${authInputState(Boolean(fieldErrors.email))}`}
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-2 text-[13px] text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-[14px] font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            onBlur={() => setCapsLock(false)}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              [fieldErrors.password && "password-error", capsLock && "caps-hint"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={`pr-12 ${authInput} ${authInputState(Boolean(fieldErrors.password))}`}
          />
          <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        </div>
        {fieldErrors.password && (
          <p id="password-error" className="mt-2 text-[13px] text-red-600">
            {fieldErrors.password}
          </p>
        )}
        {capsLock && (
          <p id="caps-hint" className="mt-2 text-[13px] text-amber-700">
            Caps Lock is on.
          </p>
        )}
      </div>

      <button type="submit" disabled={submitting} className={authSubmit}>
        {submitting && <Spinner />}
        {submitting ? "Logging in…" : "Log in"}
      </button>

      {DEMO_ACCOUNTS.length > 0 && (
        <div className="rounded-[14px] border border-dashed border-black/15 p-4">
          <p className="font-mono text-[11px] text-muted">Local demo accounts</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.role}
                type="button"
                disabled={submitting}
                onClick={() => {
                  chooseRole(demo.role);
                  setEmail(demo.email);
                  setPassword(demo.password);
                  setFieldErrors({});
                  setFormError(null);
                }}
                className="press rounded-full bg-white px-3 py-1.5 text-[13px] shadow-[0_0_0_1px_rgb(0_0_0/0.06)] hover:bg-stone"
              >
                Fill {demo.role.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
