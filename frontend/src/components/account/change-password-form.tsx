"use client";

import { useState, type FormEvent } from "react";

import { Alert, Button, Card, Field, inputClass } from "@/components/staff/ui";
import { ApiError } from "@/lib/api";

const MAX_PASSWORD_LENGTH = 128;

type Rule = { label: string; test: (p: string) => boolean };

/**
 * Password rules matching the backend (app/schemas/account.py). Customers use the signup
 * rule (more than 8 characters); staff and admin need at least 12 characters.
 */
export function passwordRules(minLength: number): Rule[] {
  return [
    minLength === 9
      ? { label: "More than 8 characters", test: (p) => p.length > 8 }
      : { label: `At least ${minLength} characters`, test: (p) => p.length >= minLength },
    { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
    { label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
    { label: "A special character (e.g. @ # $ !)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  ];
}

type FieldErrors = { current?: string; next?: string; confirm?: string };

function validate(rules: Rule[], current: string, next: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!current) errors.current = "Enter your current password.";
  if (!next) errors.next = "Enter a new password.";
  else if (next.length > MAX_PASSWORD_LENGTH) errors.next = "Password is too long.";
  else if (!rules.every((rule) => rule.test(next)))
    errors.next = "Password doesn't meet all the requirements below.";
  else if (next === current) errors.next = "Choose a password different from your current one.";
  if (!confirm) errors.confirm = "Confirm your new password.";
  else if (confirm !== next) errors.confirm = "Passwords don't match.";
  return errors;
}

function changeErrorMessage(error: unknown): { field?: keyof FieldErrors; message: string } {
  if (error instanceof ApiError) {
    if (error.status === 400) return { field: "current", message: error.message };
    if (error.status === 422)
      return { field: "next", message: "This password doesn't meet the requirements." };
    if (error.status === 429) {
      const minutes = error.retryAfterSeconds ? Math.ceil(error.retryAfterSeconds / 60) : null;
      return {
        message: minutes
          ? `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
          : "Too many wrong attempts. Try again later.",
      };
    }
    if (error.status === 401) return { message: "Your session expired. Sign in again." };
    if (error.status === 403) return { message: "You don't have permission to do that." };
    return { message: error.message };
  }
  return { message: "Unable to reach the server. Check your connection and try again." };
}

/**
 * "Change password" card: current password, new password with a live rule checklist,
 * and confirmation. `onSubmit` calls the role's endpoint.
 */
export function ChangePasswordForm({
  minLength,
  onSubmit,
}: {
  minLength: number;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const rules = passwordRules(minLength);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = validate(rules, current, next, confirm);
    setErrors(found);
    setFormError(null);
    setSuccess(false);
    if (found.current || found.next || found.confirm) return;

    setSubmitting(true);
    try {
      await onSubmit(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setShow(false);
      setSuccess(true);
    } catch (error) {
      const { field, message } = changeErrorMessage(error);
      if (field) setErrors({ [field]: message });
      else setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const type = show ? "text" : "password";

  return (
    <Card
      title="Change password"
      actions={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
        >
          {show ? "Hide passwords" : "Show passwords"}
        </button>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
        {success && (
          <Alert tone="success">
            Password changed. You&apos;re still signed in here; other devices were signed out.
          </Alert>
        )}
        {formError && <Alert>{formError}</Alert>}

        <Field label="Current password" htmlFor="current-password" error={errors.current}>
          <input
            id="current-password"
            type={type}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.current)}
            aria-describedby={errors.current ? "current-password-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field label="New password" htmlFor="new-password" error={errors.next}>
          <input
            id="new-password"
            type={type}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.next)}
            aria-describedby="new-password-rules"
            className={inputClass}
          />
        </Field>
        <ul id="new-password-rules" className="-mt-2 space-y-1">
          {rules.map((rule) => {
            const met = rule.test(next);
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

        <Field label="Confirm new password" htmlFor="confirm-password" error={errors.confirm}>
          <input
            id="confirm-password"
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? "confirm-password-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Button type="submit" busy={submitting}>
          {submitting ? "Changing…" : "Change password"}
        </Button>
      </form>
    </Card>
  );
}
