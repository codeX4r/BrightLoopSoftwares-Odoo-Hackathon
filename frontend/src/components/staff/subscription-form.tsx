"use client";

import { useEffect, useState } from "react";

import {
  draftFromLine,
  linesForPlan,
  linesToInput,
  LinesEditor,
  PlanFields,
  useQuotationCatalog,
  validateLines,
  withCurrentPlan,
  type Catalog,
  type Errors,
  type LineDraft,
  type PlanChoice,
} from "@/components/staff/quotation-fields";
import {
  Alert,
  CustomerCell,
  Button,
  Card,
  Field,
  inputClass,
  LoadingRow,
} from "@/components/staff/ui";
import { formatMoney } from "@/lib/format";
import {
  customerOptions,
  errorMessage,
  listTemplates,
  type BillingFrequency,
  type CustomerSummary,
  type QuotationTemplate,
  type Subscription,
  type SubscriptionInput,
} from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

/**
 * Create or edit a draft quotation. New quotations can start from a template
 * (`templateId` preselects one, e.g. from the templates screen).
 */
export function SubscriptionForm({
  initial,
  templateId,
  submitLabel,
  onSubmit,
}: {
  initial?: Subscription;
  templateId?: string | null;
  submitLabel: string;
  onSubmit: (input: SubscriptionInput) => Promise<void>;
}) {
  const catalog = useQuotationCatalog();
  const templates = useApiData(
    () => (initial ? Promise.resolve([]) : listTemplates(true)),
    [Boolean(initial)],
  );

  const error = catalog.error ?? templates.error;
  if (error && (!catalog.data || !templates.data)) return <Alert>{error}</Alert>;
  if (!catalog.data || !templates.data) return <LoadingRow />;

  return (
    <QuotationForm
      catalog={catalog.data}
      templates={templates.data}
      initial={initial}
      templateId={templateId ?? null}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
    />
  );
}

function QuotationForm({
  catalog,
  templates,
  initial,
  templateId,
  submitLabel,
  onSubmit,
}: {
  catalog: Catalog;
  templates: QuotationTemplate[];
  initial?: Subscription;
  templateId: string | null;
  submitLabel: string;
  onSubmit: (input: SubscriptionInput) => Promise<void>;
}) {
  const plans = withCurrentPlan(
    catalog.plans,
    initial
      ? {
          plan_id: initial.plan_id,
          plan_name: initial.plan_name,
          billing_frequency: initial.billing_frequency,
          rules: initial.plan_rules,
          planLinePrice: initial.lines.find((l) => l.is_plan_line)?.unit_price,
        }
      : null,
  );

  // A template passed in the link (e.g. "Use" on the templates screen) fills the form.
  const linked = !initial && templateId ? templates.find((t) => t.id === templateId) : undefined;
  const [start] = useState(() =>
    linked ? valuesFromTemplate(linked, catalog) : valuesFromSubscription(initial),
  );

  const [customer, setCustomer] = useState<CustomerSummary | null>(initial?.customer ?? null);
  const [chosenTemplate, setChosenTemplate] = useState(linked?.id ?? "");
  const [templateNote, setTemplateNote] = useState<string | null>(start.note);
  const [planId, setPlanId] = useState(start.planId);
  const [planName, setPlanName] = useState(start.planName);
  const [frequency, setFrequency] = useState<BillingFrequency>(start.frequency);
  const [paymentTerms, setPaymentTerms] = useState(start.paymentTerms);
  const [validityDays, setValidityDays] = useState(start.validityDays);
  const [expiryDate, setExpiryDate] = useState(initial?.expiry_date ?? "");
  const [notes, setNotes] = useState(start.notes);
  const [lines, setLines] = useState<LineDraft[]>(start.lines);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;

  function changePlan(next: PlanChoice | null) {
    setPlanId(next?.id ?? "");
    if (!next && plan) {
      // Keep the plan's name and billing as a starting point for the custom plan.
      setPlanName(plan.name);
      setFrequency(plan.billing_frequency);
    }
    setLines((prev) => linesForPlan(prev, next, catalog.taxes));
  }

  function applyTemplate(id: string) {
    setChosenTemplate(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const values = valuesFromTemplate(template, catalog);
    setTemplateNote(values.note);
    setPlanId(values.planId);
    setPlanName(values.planName);
    setFrequency(values.frequency);
    setPaymentTerms(values.paymentTerms);
    setValidityDays(values.validityDays);
    setNotes(values.notes);
    setLines(values.lines);
    setErrors({});
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!customer) next.customer = "Choose a customer.";
    if (!plan && !planName.trim()) next.plan = "Enter the plan name.";
    const terms = Number(paymentTerms);
    if (!Number.isInteger(terms) || terms < 0 || terms > 365)
      next.terms = "Use a whole number of days from 0 to 365.";
    const validity = Number(validityDays);
    if (!Number.isInteger(validity) || validity < 1 || validity > 365)
      next.validity = "Use a whole number of days from 1 to 365.";
    validateLines(lines, plan, next);
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || !customer) return;

    const input: SubscriptionInput = {
      customer_id: customer.id,
      plan_name: plan ? null : planName.trim(),
      billing_frequency: plan ? null : frequency,
      payment_terms_days: Number(paymentTerms),
      quotation_validity_days: Number(validityDays),
      expiry_date: expiryDate || null,
      notes: notes.trim() || null,
      lines: linesToInput(lines),
    };
    // On edit, an unchanged plan is left out so a plan the admin has since retired stays.
    if (!initial || planId !== (initial.plan_id ?? "")) input.plan_id = planId || null;

    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert>{formError}</Alert>}

      {!initial && templates.length > 0 && (
        <Card title="Start from a template">
          <Field
            label="Template"
            htmlFor="template"
            hint="Fills in the plan, terms, notes and lines below. You can still change them."
          >
            <select
              id="template"
              value={chosenTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
              className={inputClass}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.plan_name} · {formatMoney(t.total)}
                </option>
              ))}
            </select>
          </Field>
          {templateNote && (
            <div className="mt-3">
              <Alert tone="info">{templateNote}</Alert>
            </div>
          )}
        </Card>
      )}

      <Card title="Customer and plan">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CustomerPicker value={customer} onChange={setCustomer} error={errors.customer} />
          </div>
          <PlanFields
            plans={plans}
            planId={planId}
            onPlanChange={changePlan}
            planName={planName}
            onPlanNameChange={setPlanName}
            frequency={frequency}
            onFrequencyChange={setFrequency}
            error={errors.plan}
          />
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
            label="Quotation valid for (days)"
            htmlFor="validity"
            error={errors.validity}
            hint="Counted from the day the quotation is sent."
          >
            <input
              id="validity"
              type="number"
              min={1}
              max={365}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              aria-invalid={Boolean(errors.validity)}
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

      <Card title="Lines">
        <LinesEditor
          lines={lines}
          setLines={setLines}
          plan={plan}
          catalog={catalog}
          errors={errors}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" busy={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type StartValues = {
  planId: string;
  planName: string;
  frequency: BillingFrequency;
  paymentTerms: string;
  validityDays: string;
  notes: string;
  lines: LineDraft[];
  note: string | null;
};

function valuesFromSubscription(sub: Subscription | undefined): StartValues {
  return {
    planId: sub?.plan_id ?? "",
    planName: sub?.plan_name ?? "",
    frequency: sub?.billing_frequency ?? "MONTHLY",
    paymentTerms: String(sub?.payment_terms_days ?? 15),
    validityDays: String(sub?.quotation_validity_days ?? 15),
    notes: sub?.notes ?? "",
    lines: sub?.lines.map(draftFromLine) ?? [],
    note: null,
  };
}

function valuesFromTemplate(template: QuotationTemplate, catalog: Catalog): StartValues {
  const plan = template.plan_id
    ? (catalog.plans.find((p) => p.id === template.plan_id) ?? null)
    : null;
  let lines = template.lines.map(draftFromLine);
  let note: string | null = null;
  if (template.plan_id && !plan) {
    // The plan isn't offered today, so the quotation uses the template's plan as custom.
    lines = linesForPlan(lines, null, catalog.taxes);
    note = `The template's plan "${template.plan_name}" isn't offered today, so it was added as a custom plan.`;
  }
  return {
    planId: plan?.id ?? "",
    planName: template.plan_name,
    frequency: template.billing_frequency,
    paymentTerms: String(template.payment_terms_days),
    validityDays: String(template.validity_days),
    notes: template.notes ?? "",
    lines,
    note,
  };
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
      hint="Active customer accounts. Search by name, company or email."
    >
      <input
        id="customer-search"
        type="search"
        value={search}
        placeholder="Search customers"
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
