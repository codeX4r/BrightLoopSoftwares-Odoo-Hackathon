"use client";

import { useState } from "react";

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
import { Alert, Button, Card, Field, inputClass, LoadingRow } from "@/components/staff/ui";
import {
  errorMessage,
  type BillingFrequency,
  type QuotationTemplate,
  type TemplateInput,
} from "@/lib/staff-api";

/** Create or edit a quotation template: a plan, terms, notes and lines without a customer. */
export function TemplateForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: QuotationTemplate;
  submitLabel: string;
  onSubmit: (input: TemplateInput) => Promise<void>;
}) {
  const catalog = useQuotationCatalog();
  if (catalog.error && !catalog.data) return <Alert>{catalog.error}</Alert>;
  if (!catalog.data) return <LoadingRow />;
  return (
    <Form catalog={catalog.data} initial={initial} submitLabel={submitLabel} onSubmit={onSubmit} />
  );
}

function Form({
  catalog,
  initial,
  submitLabel,
  onSubmit,
}: {
  catalog: Catalog;
  initial?: QuotationTemplate;
  submitLabel: string;
  onSubmit: (input: TemplateInput) => Promise<void>;
}) {
  const plans = withCurrentPlan(
    catalog.plans,
    initial
      ? {
          plan_id: initial.plan_id,
          plan_name: initial.plan_name,
          billing_frequency: initial.billing_frequency,
          planLinePrice: initial.lines.find((l) => l.is_plan_line)?.unit_price,
        }
      : null,
  );

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [planId, setPlanId] = useState(initial?.plan_id ?? "");
  const [planName, setPlanName] = useState(initial?.plan_name ?? "");
  const [frequency, setFrequency] = useState<BillingFrequency>(
    initial?.billing_frequency ?? "MONTHLY",
  );
  const [paymentTerms, setPaymentTerms] = useState(String(initial?.payment_terms_days ?? 15));
  const [validityDays, setValidityDays] = useState(String(initial?.validity_days ?? 15));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [lines, setLines] = useState<LineDraft[]>(() => initial?.lines.map(draftFromLine) ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;

  function changePlan(next: PlanChoice | null) {
    setPlanId(next?.id ?? "");
    if (!next && plan) {
      setPlanName(plan.name);
      setFrequency(plan.billing_frequency);
    }
    setLines((prev) => linesForPlan(prev, next, catalog.taxes));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter a template name.";
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
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        plan_id: planId || null,
        plan_name: plan ? null : planName.trim(),
        billing_frequency: plan ? null : frequency,
        validity_days: Number(validityDays),
        payment_terms_days: Number(paymentTerms),
        notes: notes.trim() || null,
        is_active: isActive,
        lines: linesToInput(lines),
      });
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert>{formError}</Alert>}

      <Card title="Template">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Template name" htmlFor="name" error={errors.name}>
            <input
              id="name"
              value={name}
              maxLength={200}
              placeholder="e.g. Standard yearly offer"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={inputClass}
            />
          </Field>
          <Field
            label="Available to staff"
            htmlFor="active"
            hint="Inactive templates are hidden from the new quotation form."
          >
            <label className="flex items-center gap-2 py-2 text-sm text-zinc-800">
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Active
            </label>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (optional)" htmlFor="description">
              <textarea
                id="description"
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Plan and terms">
        <div className="grid gap-5 sm:grid-cols-2">
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
          <Field label="Payment terms (days)" htmlFor="terms" error={errors.terms}>
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
          <Field label="Quotation valid for (days)" htmlFor="validity" error={errors.validity}>
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
          <div className="sm:col-span-2">
            <Field label="Notes for the quotation (optional)" htmlFor="notes">
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
