"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { getCurrentUser, login, ROLE_HOME, type Role } from "@/lib/auth";

type FieldErrors = { role?: string; email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
  { value: "CUSTOMER", label: "Customer" },
];

function validate(role: Role | "", email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!role) errors.role = "Select your role.";
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length > 128) errors.password = "Password is too long.";
  return errors;
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid email, password or role.";
    if (error.status === 429) {
      const minutes = error.retryAfterSeconds ? Math.ceil(error.retryAfterSeconds / 60) : null;
      return minutes
        ? `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
        : "Too many failed attempts. Try again later.";
    }
    if (error.status === 422) return "Check your email and password and try again.";
    return "Something went wrong. Please try again.";
  }
  return "Unable to reach the server. Check your connection and try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Send the user to their home page.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) router.replace(ROLE_HOME[user.role]);
      })
      .catch(() => {
        // Not signed in; stay on the login page.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(role, email, password);
    setFieldErrors(errors);
    setFormError(null);
    if (!role || errors.email || errors.password) return;

    setSubmitting(true);
    try {
      // The backend checks the selected role against the account and returns the real
      // role from the database; redirect on that, not on the dropdown value.
      const accountRole = await login(email.trim(), password, role);
      router.replace(ROLE_HOME[accountRole]);
    } catch (error) {
      setFormError(loginErrorMessage(error));
      setPassword("");
      setSubmitting(false);
    }
  }

  const inputBase =
    "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100";
  const inputState = (hasError: boolean) =>
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
      : "border-zinc-300 focus:border-indigo-500 focus:ring-indigo-200";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-zinc-800">
          Login as
        </label>
        <div className="relative mt-1.5">
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role | "")}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.role)}
            aria-describedby={fieldErrors.role ? "role-error" : undefined}
            className={`appearance-none pr-10 ${inputBase} ${inputState(Boolean(fieldErrors.role))} ${role ? "" : "text-zinc-400"}`}
          >
            <option value="" disabled>
              Select your role
            </option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="text-zinc-900">
                {option.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute inset-y-0 right-3 my-auto h-5 w-5 text-zinc-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        {fieldErrors.role && (
          <p id="role-error" className="mt-1.5 text-sm text-red-600">
            {fieldErrors.role}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className={`mt-1.5 ${inputBase} ${inputState(Boolean(fieldErrors.email))}`}
        />
        {fieldErrors.email && (
          <p id="email-error" className="mt-1.5 text-sm text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-zinc-800">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className={`pr-11 ${inputBase} ${inputState(Boolean(fieldErrors.password))}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-500 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="password-error" className="mt-1.5 text-sm text-red-600">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting && <Spinner />}
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
