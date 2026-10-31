"use client";

import { useId, useState, type FormEvent } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Button } from "@/components/ui/button";
import { Badge, ConfirmDialog, Modal } from "@/components/ui/feedback";
import { Field, inputClass } from "@/components/ui/field";
import { peopleApi, type NewAccountInput } from "@/lib/admin-api";
import { errorText } from "@/lib/format";

/** Matches UserCreate on the backend (the rule used for every internally created account). */
const PASSWORD_MIN_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "green" : "zinc"}>{active ? "Active" : "Inactive"}</Badge>;
}

/** Create a customer or staff account with an initial password. */
export function NewAccountModal({
  kind,
  onClose,
  onCreate,
}: {
  kind: "customer" | "staff member";
  onClose: () => void;
  onCreate: (input: NewAccountInput) => Promise<unknown>;
}) {
  const notify = useNotify();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: { email?: string; password?: string } = {};
    if (!EMAIL_PATTERN.test(email.trim())) found.email = "Enter a valid email address.";
    if (password.length < PASSWORD_MIN_LENGTH) {
      found.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    } else if (!password.trim()) {
      found.password = "Password must not be blank.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await onCreate({ email: email.trim(), password });
      notify(`${kind === "customer" ? "Customer" : "Staff member"} account created.`);
    } catch (err) {
      notify(errorText(err), "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`New ${kind}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={`${uid}-form`} loading={saving}>
            Create account
          </Button>
        </>
      }
    >
      <form id={`${uid}-form`} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Email" htmlFor={`${uid}-email`} error={errors.email}>
          <input
            id={`${uid}-email`}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            className={inputClass(Boolean(errors.email))}
          />
        </Field>
        <Field
          label="Initial password"
          htmlFor={`${uid}-password`}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. Share it with the person securely.`}
        >
          <div className="relative">
            <input
              id={`${uid}-password`}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              className={`pr-16 ${inputClass(Boolean(errors.password))}`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
      </form>
    </Modal>
  );
}

/** Confirms and applies an activate/deactivate through the existing status endpoint. */
export function StatusChangeDialog({
  account,
  onClose,
  onChanged,
}: {
  account: { id: string; email: string; is_active: boolean } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const deactivating = account?.is_active ?? false;

  async function confirm() {
    if (!account) return;
    setBusy(true);
    try {
      await peopleApi.setActive(account.id, !account.is_active);
      notify(deactivating ? "Account deactivated." : "Account activated.");
      onChanged();
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <ConfirmDialog
      open={account !== null}
      title={deactivating ? "Deactivate account?" : "Activate account?"}
      message={
        deactivating
          ? `${account?.email ?? ""} will be signed out and won't be able to log in until reactivated. Their records are kept.`
          : `${account?.email ?? ""} will be able to log in again.`
      }
      confirmLabel={deactivating ? "Deactivate" : "Activate"}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
