"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { getCurrentUser, ROLE_HOME, signupCustomer } from "@/lib/auth";

type FieldErrors = { email?: string; password?: string; confirm?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;

// Same rule as the backend (app/schemas/auth.py): longer than 8 characters, with an
// uppercase letter, a lowercase letter and a special character.
const PASSWORD_RULES = [
  { label: "More than 8 characters", test: (p: string) => p.length > 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A special character (e.g. @ # $ !)", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
];

function validate(email: string, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length > MAX_PASSWORD_LENGTH) errors.password = "Password is too long.";
  else if (!PASSWORD_RULES.every((rule) => rule.test(password)))
    errors.password = "Password doesn't meet all the requirements below.";
  if (!confirm) errors.confirm = "Confirm your password.";
  else if (confirm !== password) errors.confirm = "Passwords don't match.";
  return errors;
}

function signupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return error.message;
    if (error.status === 422) return "Check your email and password and try again.";
    return "Something went wrong. Please try again.";
  }
  return "Unable to reach the server. Check your connection and try again.";
}

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Send the user to their home page.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) router.replace(ROLE_HOME[user.role]);
      })
      .catch(() => {
        // Not signed in; stay on the signup page.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(email, password, confirm);
    setFieldErrors(errors);
    setFormError(null);
    setEmailTaken(false);
    if (errors.email || errors.password || errors.confirm) return;

    setSubmitting(true);
    try {
      const role = await signupCustomer(email.trim(), password);
      router.replace(ROLE_HOME[role]);
    } catch (error) {
      setFormError(signupErrorMessage(error));
      setEmailTaken(error instanceof ApiError && error.status === 409);
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
          {emailTaken && (
            <>
              {" "}
              <Link href="/login" className="font-semibold underline">
                Go to sign in
              </Link>
            </>
          )}
        </div>
      )}

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
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby="password-rules"
            className={`pr-16 ${inputBase} ${inputState(Boolean(fieldErrors.password))}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {fieldErrors.password && (
          <p className="mt-1.5 text-sm text-red-600">{fieldErrors.password}</p>
        )}
        <ul id="password-rules" className="mt-2 space-y-1">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs ${met ? "text-emerald-700" : "text-zinc-500"}`}
              >
                <span aria-hidden="true">{met ? "✓" : "○"}</span>
                {rule.label}
                <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-zinc-800">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={submitting}
          aria-invalid={Boolean(fieldErrors.confirm)}
          aria-describedby={fieldErrors.confirm ? "confirm-error" : undefined}
          className={`mt-1.5 ${inputBase} ${inputState(Boolean(fieldErrors.confirm))}`}
        />
        {fieldErrors.confirm && (
          <p id="confirm-error" className="mt-1.5 text-sm text-red-600">
            {fieldErrors.confirm}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
