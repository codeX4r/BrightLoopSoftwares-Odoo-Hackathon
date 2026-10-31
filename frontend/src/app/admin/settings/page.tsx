"use client";

import { useId, useState, type FormEvent } from "react";

import { Panel } from "@/components/admin/detail-ui";
import { useNotify } from "@/components/admin/toast-context";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { Field, inputClass } from "@/components/ui/field";
import { adminModulesApi, type AppSettings } from "@/lib/admin-modules-api";
import { errorText, formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

type Values = {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  currency: string;
  timezone: string;
  invoicePrefix: string;
};

type Errors = Partial<Record<keyof Values, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-. ]{6,32}$/;
const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,9}$/;

function toValues(s: AppSettings): Values {
  return {
    companyName: s.company_name,
    companyAddress: s.company_address ?? "",
    companyEmail: s.company_email ?? "",
    companyPhone: s.company_phone ?? "",
    currency: s.currency,
    timezone: s.timezone,
    invoicePrefix: s.invoice_prefix,
  };
}

function validate(v: Values): Errors {
  const errors: Errors = {};
  if (!v.companyName.trim()) errors.companyName = "Company name is required.";
  else if (v.companyName.trim().length > 200) errors.companyName = "Use 200 characters or fewer.";
  if (v.companyEmail.trim() && !EMAIL_PATTERN.test(v.companyEmail.trim())) {
    errors.companyEmail = "Enter a valid email address, or leave empty.";
  }
  if (v.companyPhone.trim() && !PHONE_PATTERN.test(v.companyPhone.trim())) {
    errors.companyPhone = "Use 6–32 digits, spaces or + ( ) - . characters.";
  }
  if (!PREFIX_PATTERN.test(v.invoicePrefix.trim().toUpperCase())) {
    errors.invoicePrefix = "1–10 letters or digits, starting with a letter.";
  }
  return errors;
}

export default function SettingsPage() {
  const settings = useAsyncData(adminModulesApi.getSettings, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">Company details and invoice numbering.</p>
      </div>
      {settings.loading && !settings.data && <LoadingState />}
      {settings.error && <ErrorState message={settings.error} onRetry={settings.reload} />}
      {settings.data && (
        // Remount the form after a save so it starts from the server's values.
        <SettingsForm
          key={settings.data.updated_at}
          settings={settings.data}
          onSaved={settings.reload}
        />
      )}
    </div>
  );
}

function SettingsForm({ settings, onSaved }: { settings: AppSettings; onSaved: () => void }) {
  const notify = useNotify();
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [values, setValues] = useState<Values>(() => toValues(settings));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await adminModulesApi.updateSettings({
        company_name: values.companyName.trim(),
        company_address: values.companyAddress.trim(),
        company_email: values.companyEmail.trim(),
        company_phone: values.companyPhone.trim(),
        currency: values.currency,
        timezone: values.timezone,
        invoice_prefix: values.invoicePrefix.trim().toUpperCase(),
      });
      notify("Settings saved.");
      onSaved();
    } catch (err) {
      notify(errorText(err), "error");
      setSaving(false);
    }
  }

  const prefixPreview = `${values.invoicePrefix.trim().toUpperCase() || "INV"}-00001`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Panel title="Company">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Company name" htmlFor={fid("name")} error={errors.companyName}>
              <input
                id={fid("name")}
                value={values.companyName}
                maxLength={200}
                onChange={(e) => update("companyName", e.target.value)}
                aria-invalid={Boolean(errors.companyName)}
                className={inputClass(Boolean(errors.companyName))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address" htmlFor={fid("address")}>
              <textarea
                id={fid("address")}
                rows={3}
                maxLength={2000}
                value={values.companyAddress}
                onChange={(e) => update("companyAddress", e.target.value)}
                className={inputClass()}
              />
            </Field>
          </div>
          <Field label="Email" htmlFor={fid("email")} error={errors.companyEmail}>
            <input
              id={fid("email")}
              type="email"
              value={values.companyEmail}
              onChange={(e) => update("companyEmail", e.target.value)}
              aria-invalid={Boolean(errors.companyEmail)}
              className={inputClass(Boolean(errors.companyEmail))}
            />
          </Field>
          <Field label="Phone" htmlFor={fid("phone")} error={errors.companyPhone}>
            <input
              id={fid("phone")}
              type="tel"
              value={values.companyPhone}
              onChange={(e) => update("companyPhone", e.target.value)}
              aria-invalid={Boolean(errors.companyPhone)}
              className={inputClass(Boolean(errors.companyPhone))}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Billing">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Invoice prefix"
            htmlFor={fid("prefix")}
            error={errors.invoicePrefix}
            hint={`New invoices look like ${prefixPreview}. Existing invoice numbers don't change.`}
          >
            <input
              id={fid("prefix")}
              value={values.invoicePrefix}
              maxLength={10}
              onChange={(e) => update("invoicePrefix", e.target.value.toUpperCase())}
              aria-invalid={Boolean(errors.invoicePrefix)}
              className={`uppercase ${inputClass(Boolean(errors.invoicePrefix))}`}
            />
          </Field>
          <Field
            label="Currency"
            htmlFor={fid("currency")}
            hint="Only INR is supported for now; billing amounts are in rupees."
          >
            <select
              id={fid("currency")}
              value={values.currency}
              onChange={(e) => update("currency", e.target.value)}
              className={inputClass()}
            >
              {settings.supported_currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Time zone"
            htmlFor={fid("timezone")}
            hint="Business dates (billing, due dates, reports) use India time."
          >
            <select
              id={fid("timezone")}
              value={values.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className={inputClass()}
            >
              {settings.supported_timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">Last saved {formatDateTime(settings.updated_at)}</p>
        <Button type="submit" loading={saving}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
