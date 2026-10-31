"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  EMPTY_PROFILE,
  ProfileFields,
  profilePayload,
  validateProfile,
  type ProfileErrors,
} from "@/components/staff/customer-profile-fields";
import { Alert, Button, Card, Field, inputClass, PageHeader } from "@/components/staff/ui";
import { createCustomer, errorMessage } from "@/lib/staff-api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rule as customer signup (app/schemas/auth.py).
function passwordProblem(p: string): string | null {
  if (p.length <= 8) return "Use more than 8 characters.";
  if (!/[A-Z]/.test(p)) return "Add an uppercase letter.";
  if (!/[a-z]/.test(p)) return "Add a lowercase letter.";
  if (!/[^A-Za-z0-9\s]/.test(p)) return "Add a special character, e.g. @ # $ !";
  return null;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [errors, setErrors] = useState<ProfileErrors & { email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const next: typeof errors = validateProfile(profile, { nameRequired: true });
    if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const created = await createCustomer({
        email: email.trim(),
        password,
        ...profilePayload(profile),
      });
      router.replace(`/staff/customers/${created.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/staff/customers" className="text-sm text-indigo-600 hover:text-indigo-500">
        ← Customers
      </Link>
      <PageHeader
        title="Add customer"
        description="Creates a customer portal login. Share the email and password with the customer."
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formError && <Alert>{formError}</Alert>}
        <Card title="Login">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={errors.email}>
              <input
                id="email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Initial password"
              htmlFor="password"
              error={errors.password}
              hint="More than 8 characters, with upper and lower case and a special character."
            >
              <input
                id="password"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>
        <Card title="Contact details">
          <ProfileFields values={profile} errors={errors} onChange={setProfile} />
        </Card>
        <div className="flex justify-end">
          <Button type="submit" busy={submitting}>
            {submitting ? "Creating…" : "Create customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
