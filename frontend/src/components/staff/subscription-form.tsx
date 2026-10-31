"use client";

import { useEffect, useState } from "react";

import { Alert, CustomerCell, Button, Card, Field, inputClass } from "@/components/staff/ui";
import { FREQUENCY_LABEL, formatMoney } from "@/lib/format";
import {
  customerOptions,
  errorMessage,
  type BillingFrequency,
  type CustomerSummary,
  type Subscription,
  type SubscriptionInput,
} from "@/lib/staff-api";

const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as BillingFrequency[];
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

type LineDraft = {
  key: number;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};
type Errors = Record<string, string>;

let nextKey = 1;
const blankLine = (): LineDraft => ({
  key: nextKey++,
  description: "",
  quantity: "1",
  unit_price: "",
  tax_rate: "18",
});

/** Line totals in paise, to avoid floating-point drift in the preview. */
function previewTotals(line: LineDraft) {
  const qty = Number(line.quantity);
  if (!Number.isInteger(qty) || qty < 1 || !MONEY_PATTERN.test(line.unit_price)) return null;
  const unitPaise = Math.round(Number(line.unit_price) * 100);
  const subtotal = qty * unitPaise;
  const rate = Number(line.tax_rate);
  const tax = Number.isFinite(rate) ? Math.round((subtotal * rate) / 100) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

export function SubscriptionForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Subscription;
  submitLabel: string;
  onSubmit: (input: SubscriptionInput) => Promise<void>;
}) {
  const [customer, setCustomer] = useState<CustomerSummary | null>(initial?.customer ?? null);
  const [planName, setPlanName] = useState(initial?.plan_name ?? "");
  const [frequency, setFrequency] = useState<BillingFrequency>(
    initial?.billing_frequency ?? "MONTHLY",
  );
  const [paymentTerms, setPaymentTerms] = useState(String(initial?.payment_terms_days ?? 15));
  const [expiryDate, setExpiryDate] = useState(initial?.expiry_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initial?.lines.length
      ? initial.lines.map((l) => ({
          key: nextKey++,
          description: l.description,
          quantity: String(l.quantity),
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        }))
      : [blankLine()],
  );
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!customer) next.customer = "Choose a customer.";
    if (!planName.trim()) next.plan = "Enter the plan name.";
    const terms = Number(paymentTerms);
    if (!Number.isInteger(terms) || terms < 0 || terms > 365)
      next.terms = "Use a whole number of days from 0 to 365.";
    if (lines.length === 0) next.lines = "Add at least one line.";
    lines.forEach((line) => {
      if (!line.description.trim()) next[`desc-${line.key}`] = "Required";
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty < 1) next[`qty-${line.key}`] = "Whole number, 1 or more";
      if (!MONEY_PATTERN.test(line.unit_price)) next[`price-${line.key}`] = "e.g. 999 or 999.50";
      const rate = Number(line.tax_rate);
      if (line.tax_rate === "" || !Number.isFinite(rate) || rate < 0 || rate > 100)
        next[`tax-${line.key}`] = "0 to 100";
    });
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || !customer) return;

    setSubmitting(true);
    try {
      await onSubmit({
        customer_id: customer.id,
        plan_name: planName.trim(),
        billing_frequency: frequency,
        payment_terms_days: Number(paymentTerms),
        expiry_date: expiryDate || null,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        })),
      });
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  const totals = lines.reduce(
    (acc, line) => {
      const t = previewTotals(line);
      return t
        ? { subtotal: acc.subtotal + t.subtotal, tax: acc.tax + t.tax, total: acc.total + t.total }
        : acc;
    },
    { subtotal: 0, tax: 0, total: 0 },
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert>{formError}</Alert>}

      <Card title="Customer and plan">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CustomerPicker value={customer} onChange={setCustomer} error={errors.customer} />
          </div>
          <Field label="Plan name" htmlFor="plan" error={errors.plan}>
            <input
              id="plan"
              value={planName}
              maxLength={200}
              placeholder="e.g. Enterprise Plan"
              onChange={(e) => setPlanName(e.target.value)}
              aria-invalid={Boolean(errors.plan)}
              className={inputClass}
            />
          </Field>
          <Field label="Billing frequency" htmlFor="frequency">
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as BillingFrequency)}
              className={inputClass}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Payment terms (days)"
            htmlFor="terms"
            error={errors.terms}
            hint="Invoice due date = billing date + these days."
          >
            <input
              id="terms"
              type="number"
              min={0}
              max={365}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              aria-invalid={Boolean(errors.terms)}
              className={inputClass}
            />
          </Field>
          <Field
            label="Expiry date (optional)"
            htmlFor="expiry"
            hint="Billing stops after this date."
          >
            <input
              id="expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes (optional)" htmlFor="notes">
              <textarea
                id="notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title="Lines"
        actions={
          <Button variant="secondary" onClick={() => setLines((prev) => [...prev, blankLine()])}>
            Add line
          </Button>
        }
      >
        <p className="mb-4 text-xs text-zinc-500">
          Amounts are per billing cycle. Products, plans and taxes will be selectable once the admin
          catalogue is available; for now enter them by hand.
        </p>
        {errors.lines && <p className="mb-3 text-sm text-red-600">{errors.lines}</p>}
        <div className="space-y-3">
          {lines.map((line, index) => {
            const t = previewTotals(line);
            return (
              <fieldset
                key={line.key}
                className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12"
              >
                <legend className="sr-only">Line {index + 1}</legend>
                <LineInput
                  className="col-span-2 sm:col-span-5"
                  id={`desc-${line.key}`}
                  label="Description"
                  value={line.description}
                  error={errors[`desc-${line.key}`]}
                  onChange={(v) => updateLine(line.key, { description: v })}
                />
                <LineInput
                  className="sm:col-span-2"
                  id={`qty-${line.key}`}
                  label="Qty"
                  inputMode="numeric"
                  value={line.quantity}
                  error={errors[`qty-${line.key}`]}
                  onChange={(v) => updateLine(line.key, { quantity: v })}
                />
                <LineInput
                  className="sm:col-span-2"
                  id={`price-${line.key}`}
                  label="Unit price (₹)"
                  inputMode="decimal"
                  value={line.unit_price}
                  error={errors[`price-${line.key}`]}
                  onChange={(v) => updateLine(line.key, { unit_price: v })}
                />
                <LineInput
                  className="sm:col-span-1"
                  id={`tax-${line.key}`}
                  label="Tax %"
                  inputMode="decimal"
                  value={line.tax_rate}
                  error={errors[`tax-${line.key}`]}
                  onChange={(v) => updateLine(line.key, { tax_rate: v })}
                />
                <div className="flex items-end justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-end">
                  <p className="text-sm font-medium text-zinc-900">
                    {t ? formatMoney(t.total / 100) : "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="text-xs font-medium text-red-600 hover:text-red-500"
                    aria-label={`Remove line ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>
        <dl className="mt-5 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-zinc-600">
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotal / 100)}</dd>
          </div>
          <div className="flex justify-between text-zinc-600">
            <dt>Tax</dt>
            <dd>{formatMoney(totals.tax / 100)}</dd>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-1 font-semibold text-zinc-900">
            <dt>Total per cycle</dt>
            <dd>{formatMoney(totals.total / 100)}</dd>
          </div>
        </dl>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" busy={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function LineInput({
  id,
  label,
  value,
  error,
  onChange,
  className,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  className?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1 ${inputClass}`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function CustomerPicker({
  value,
  onChange,
  error,
}: {
  value: CustomerSummary | null;
  onChange: (customer: CustomerSummary | null) => void;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<CustomerSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      customerOptions(search.trim())
        .then((found) => {
          if (!cancelled) {
            setOptions(found);
            setLoadError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setLoadError(errorMessage(err));
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, value]);

  if (value) {
    return (
      <Field label="Customer" htmlFor="customer-selected">
        <div
          id="customer-selected"
          className="flex items-center justify-between rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
        >
          <CustomerCell customer={value} />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Change
          </button>
        </div>
      </Field>
    );
  }

  return (
    <Field
      label="Customer"
      htmlFor="customer-search"
      error={error ?? loadError ?? undefined}
      hint="Active customer accounts. Search by email."
    >
      <input
        id="customer-search"
        type="search"
        value={search}
        placeholder="Search customer email"
        onChange={(e) => setSearch(e.target.value)}
        aria-invalid={Boolean(error)}
        className={inputClass}
      />
      {options && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">No matching active customers.</li>
          ) : (
            options.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(c)}
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-indigo-50"
                >
                  <CustomerCell customer={c} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </Field>
  );
}
