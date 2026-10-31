"use client";

/**
 * Plan picker and line editor shared by the quotation form and the template form.
 *
 * Lines come in three kinds, matching the API:
 * - plan: priced from the chosen admin plan (at most one, quantity >= the plan minimum);
 * - product: an admin product (and variant), with price and tax filled in;
 * - custom: typed by hand.
 */
import type { Dispatch, SetStateAction } from "react";

import { Button, Field, inputClass } from "@/components/staff/ui";
import { FREQUENCY_LABEL, formatMoney } from "@/lib/format";
import {
  listPlanOptions,
  listProductOptions,
  listTaxOptions,
  type BillingFrequency,
  type PlanOption,
  type PlanRules,
  type ProductOption,
  type SubscriptionLineInput,
  type TaxOption,
} from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as BillingFrequency[];
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** A plan in the picker. `offerable` is false for a plan kept from an older quotation. */
export type PlanChoice = PlanOption & { offerable: boolean };

export type Catalog = { plans: PlanChoice[]; products: ProductOption[]; taxes: TaxOption[] };

export type LineKind = "plan" | "product" | "custom";

export type LineDraft = {
  key: number;
  kind: LineKind;
  product_id: string;
  variant_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  /** Normalised rate such as "5" or "18", so it matches the tax options. */
  tax_rate: string;
};

export type Errors = Record<string, string>;

let nextKey = 1;

/** "5.00" -> "5", "18.50" -> "18.5". */
export function rateKey(rate: string | number | null | undefined): string {
  const n = Number(rate ?? 0);
  return Number.isFinite(n) ? String(n) : "0";
}

/** Plans, products and taxes the staff member can offer today. */
export function useQuotationCatalog() {
  return useApiData<Catalog>(
    () =>
      Promise.all([listPlanOptions(), listProductOptions(), listTaxOptions()]).then(
        ([plans, products, taxes]) => ({
          plans: plans.map((p) => ({ ...p, offerable: true })),
          products,
          taxes,
        }),
      ),
    [],
  );
}

/**
 * Adds the record's current plan to the choices when the admin no longer offers it, so
 * editing an older quotation or template keeps its plan.
 */
export function withCurrentPlan(
  plans: PlanChoice[],
  current: {
    plan_id: string | null;
    plan_name: string;
    billing_frequency: BillingFrequency;
    rules?: PlanRules | null;
    planLinePrice?: string;
  } | null,
): PlanChoice[] {
  if (!current?.plan_id || plans.some((p) => p.id === current.plan_id)) return plans;
  const rules = current.rules;
  return [
    ...plans,
    {
      id: current.plan_id,
      name: current.plan_name,
      description: null,
      price: current.planLinePrice ?? "0",
      billing_frequency: current.billing_frequency,
      minimum_quantity: rules?.minimum_quantity ?? 1,
      allow_pause: rules?.allow_pause ?? false,
      allow_renewal: rules?.allow_renewal ?? false,
      allow_early_closure: rules?.allow_early_closure ?? false,
      auto_close_on_expiry: rules?.auto_close_on_expiry ?? false,
      product_ids: [],
      tax: null,
      offerable: false,
    },
  ];
}

export function defaultTaxRate(taxes: TaxOption[]): string {
  return rateKey(taxes.find((t) => t.is_default)?.rate ?? 0);
}

/** A draft from a saved quotation or template line. */
export function draftFromLine(line: {
  is_plan_line: boolean;
  product_id: string | null;
  variant_id: string | null;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
}): LineDraft {
  return {
    key: nextKey++,
    kind: line.is_plan_line ? "plan" : line.product_id ? "product" : "custom",
    product_id: line.product_id ?? "",
    variant_id: line.variant_id ?? "",
    description: line.description,
    quantity: String(line.quantity),
    unit_price: line.unit_price,
    tax_rate: rateKey(line.tax_rate),
  };
}

function planLine(plan: PlanChoice, taxes: TaxOption[]): LineDraft {
  return {
    key: nextKey++,
    kind: "plan",
    product_id: "",
    variant_id: "",
    description: plan.name,
    quantity: String(plan.minimum_quantity),
    unit_price: plan.price,
    tax_rate: plan.tax ? rateKey(plan.tax.rate) : defaultTaxRate(taxes),
  };
}

function emptyLine(kind: "product" | "custom", taxes: TaxOption[]): LineDraft {
  return {
    key: nextKey++,
    kind,
    product_id: "",
    variant_id: "",
    description: "",
    quantity: "1",
    unit_price: "",
    tax_rate: defaultTaxRate(taxes),
  };
}

/**
 * Lines after the plan changes: choosing a plan adds or re-prices its plan line; going
 * back to a custom plan turns the plan line into an ordinary line (as the API does).
 */
export function linesForPlan(
  lines: LineDraft[],
  plan: PlanChoice | null,
  taxes: TaxOption[],
): LineDraft[] {
  const existing = lines.find((l) => l.kind === "plan");
  if (!plan) {
    return lines.map((l) => (l.kind === "plan" ? { ...l, kind: "custom" } : l));
  }
  if (!existing) return [planLine(plan, taxes), ...lines];
  return lines.map((l) =>
    l.kind === "plan"
      ? {
          ...l,
          description: plan.name,
          unit_price: plan.price,
          quantity: String(Math.max(Number(l.quantity) || 0, plan.minimum_quantity)),
        }
      : l,
  );
}

/** Line totals in paise, to avoid floating-point drift in the preview. */
export function previewTotals(line: LineDraft) {
  const qty = Number(line.quantity);
  if (!Number.isInteger(qty) || qty < 1 || !MONEY_PATTERN.test(line.unit_price)) return null;
  const unitPaise = Math.round(Number(line.unit_price) * 100);
  const subtotal = qty * unitPaise;
  const rate = Number(line.tax_rate);
  const tax = Number.isFinite(rate) ? Math.round((subtotal * rate) / 100) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

/** Adds line errors to `errors` (keyed `<field>-<line key>`, plus `lines`). */
export function validateLines(lines: LineDraft[], plan: PlanChoice | null, errors: Errors) {
  if (lines.length === 0) errors.lines = "Add at least one line.";
  if (plan && !lines.some((l) => l.kind === "plan")) {
    errors.lines = `Add the ${plan.name} plan line.`;
  }
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) {
      errors[`qty-${line.key}`] = "Whole number, 1 or more";
    } else if (line.kind === "plan" && plan && qty < plan.minimum_quantity) {
      errors[`qty-${line.key}`] = `At least ${plan.minimum_quantity}`;
    }
    if (line.kind === "product" && !line.product_id) errors[`product-${line.key}`] = "Choose one";
    if (line.kind !== "plan") {
      if (!line.description.trim()) errors[`desc-${line.key}`] = "Required";
      if (!MONEY_PATTERN.test(line.unit_price)) errors[`price-${line.key}`] = "e.g. 999 or 999.50";
    }
  }
}

/** The API body for the lines. Plan lines send only quantity and tax. */
export function linesToInput(lines: LineDraft[]): SubscriptionLineInput[] {
  return lines.map((l) => {
    if (l.kind === "plan") {
      return { is_plan_line: true, quantity: Number(l.quantity), tax_rate: l.tax_rate };
    }
    return {
      product_id: l.kind === "product" ? l.product_id : null,
      variant_id: l.kind === "product" && l.variant_id ? l.variant_id : null,
      description: l.description.trim(),
      quantity: Number(l.quantity),
      unit_price: l.unit_price,
      tax_rate: l.tax_rate,
    };
  });
}

// --- Plan picker -----------------------------------------------------------

export function PlanFields({
  plans,
  planId,
  onPlanChange,
  planName,
  onPlanNameChange,
  frequency,
  onFrequencyChange,
  error,
}: {
  plans: PlanChoice[];
  planId: string;
  onPlanChange: (plan: PlanChoice | null) => void;
  planName: string;
  onPlanNameChange: (value: string) => void;
  frequency: BillingFrequency;
  onFrequencyChange: (value: BillingFrequency) => void;
  error?: string;
}) {
  const plan = plans.find((p) => p.id === planId) ?? null;
  return (
    <>
      <div className="sm:col-span-2">
        <Field
          label="Subscription plan"
          htmlFor="plan-id"
          hint={
            plans.length === 0
              ? "The admin hasn't set up any plans that can be offered today."
              : "Choose an admin plan, or a custom plan to set the name and billing yourself."
          }
        >
          <select
            id="plan-id"
            value={planId}
            onChange={(e) => onPlanChange(plans.find((p) => p.id === e.target.value) ?? null)}
            className={inputClass}
          >
            <option value="">Custom plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price)}{" "}
                {FREQUENCY_LABEL[p.billing_frequency].toLowerCase()}
                {p.offerable ? "" : " (no longer offered)"}
              </option>
            ))}
          </select>
        </Field>
        {plan && <PlanSummary plan={plan} />}
      </div>
      {!plan && (
        <>
          <Field label="Plan name" htmlFor="plan" error={error}>
            <input
              id="plan"
              value={planName}
              maxLength={200}
              placeholder="e.g. Enterprise Plan"
              onChange={(e) => onPlanNameChange(e.target.value)}
              aria-invalid={Boolean(error)}
              className={inputClass}
            />
          </Field>
          <Field label="Billing frequency" htmlFor="frequency">
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => onFrequencyChange(e.target.value as BillingFrequency)}
              className={inputClass}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
    </>
  );
}

function PlanSummary({ plan }: { plan: PlanChoice }) {
  const rules = [
    `billed ${FREQUENCY_LABEL[plan.billing_frequency].toLowerCase()}`,
    `minimum quantity ${plan.minimum_quantity}`,
    plan.allow_pause ? "can pause" : "no pausing",
    plan.allow_renewal ? "can renew" : "no renewal",
    plan.allow_early_closure ? "customer can close early" : "no early closure",
  ];
  if (plan.auto_close_on_expiry) rules.push("closes at expiry");
  return (
    <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
      {plan.description && <span className="block text-zinc-800">{plan.description}</span>}
      {rules.join(" · ")}.
      {!plan.offerable && (
        <span className="mt-1 block text-amber-700">
          The admin no longer offers this plan. It stays on this record, but once you choose another
          plan you can&apos;t switch back to it.
        </span>
      )}
    </p>
  );
}

// --- Line editor -----------------------------------------------------------

export function LinesEditor({
  lines,
  setLines,
  plan,
  catalog,
  errors,
}: {
  lines: LineDraft[];
  setLines: Dispatch<SetStateAction<LineDraft[]>>;
  plan: PlanChoice | null;
  catalog: Catalog;
  errors: Errors;
}) {
  const hasPlanLine = lines.some((l) => l.kind === "plan");

  function update(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function chooseProduct(line: LineDraft, productId: string) {
    const product = catalog.products.find((p) => p.id === productId);
    if (!product) {
      update(line.key, { product_id: "", variant_id: "" });
      return;
    }
    update(line.key, {
      product_id: product.id,
      variant_id: "",
      description: product.name,
      unit_price: product.sales_price,
      tax_rate: rateKey(product.tax?.rate ?? 0),
    });
  }

  function chooseVariant(line: LineDraft, variantId: string) {
    const product = catalog.products.find((p) => p.id === line.product_id);
    if (!product) return;
    const variant = product.variants.find((v) => v.id === variantId);
    update(line.key, {
      variant_id: variant?.id ?? "",
      description: variant ? `${product.name} (${variant.name})` : product.name,
      unit_price: variant ? variant.final_price : product.sales_price,
    });
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
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {plan && !hasPlanLine && (
          <Button
            variant="secondary"
            onClick={() => setLines((prev) => linesForPlan(prev, plan, catalog.taxes))}
          >
            Add plan line
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={catalog.products.length === 0}
          onClick={() => setLines((prev) => [...prev, emptyLine("product", catalog.taxes)])}
        >
          Add product
        </Button>
        <Button
          variant="secondary"
          onClick={() => setLines((prev) => [...prev, emptyLine("custom", catalog.taxes)])}
        >
          Add custom line
        </Button>
        <p className="text-xs text-zinc-500">
          Amounts are per billing cycle. Prices and taxes come from the admin catalog and can be
          changed per line.
        </p>
      </div>
      {errors.lines && <p className="mb-3 text-sm text-red-600">{errors.lines}</p>}
      {lines.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          No lines yet. Choose a plan or add a product.
        </p>
      )}
      <div className="space-y-3">
        {lines.map((line, index) => {
          const t = previewTotals(line);
          const product = catalog.products.find((p) => p.id === line.product_id);
          return (
            <fieldset
              key={line.key}
              className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12"
            >
              <legend className="sr-only">Line {index + 1}</legend>

              {line.kind === "plan" && (
                <ReadOnly
                  className="col-span-2 sm:col-span-5"
                  label="Plan"
                  value={plan?.name ?? line.description}
                />
              )}

              {line.kind === "product" && (
                <>
                  <LineSelect
                    className="col-span-2 sm:col-span-3"
                    id={`product-${line.key}`}
                    label="Product"
                    value={line.product_id}
                    error={errors[`product-${line.key}`]}
                    onChange={(v) => chooseProduct(line, v)}
                  >
                    <option value="">Choose a product</option>
                    {line.product_id && !product && (
                      <option value={line.product_id}>Unavailable product</option>
                    )}
                    {catalog.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </LineSelect>
                  <LineSelect
                    className="col-span-2 sm:col-span-2"
                    id={`variant-${line.key}`}
                    label="Variant"
                    value={line.variant_id}
                    disabled={!product || product.variants.length === 0}
                    onChange={(v) => chooseVariant(line, v)}
                  >
                    <option value="">
                      {product && product.variants.length > 0 ? "Standard" : "None"}
                    </option>
                    {product?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (+{formatMoney(v.additional_price)})
                      </option>
                    ))}
                  </LineSelect>
                </>
              )}

              {line.kind === "custom" && (
                <LineInput
                  className="col-span-2 sm:col-span-5"
                  id={`desc-${line.key}`}
                  label="Description"
                  value={line.description}
                  error={errors[`desc-${line.key}`]}
                  onChange={(v) => update(line.key, { description: v })}
                />
              )}

              <LineInput
                className="sm:col-span-2"
                id={`qty-${line.key}`}
                label="Qty"
                inputMode="numeric"
                value={line.quantity}
                error={errors[`qty-${line.key}`]}
                onChange={(v) => update(line.key, { quantity: v })}
              />
              {line.kind === "plan" ? (
                <ReadOnly
                  className="sm:col-span-2"
                  label="Unit price"
                  value={formatMoney(plan?.price ?? line.unit_price)}
                />
              ) : (
                <LineInput
                  className="sm:col-span-2"
                  id={`price-${line.key}`}
                  label="Unit price (₹)"
                  inputMode="decimal"
                  value={line.unit_price}
                  error={errors[`price-${line.key}`]}
                  onChange={(v) => update(line.key, { unit_price: v })}
                />
              )}
              <LineSelect
                className="sm:col-span-2"
                id={`tax-${line.key}`}
                label="Tax"
                value={line.tax_rate}
                onChange={(v) => update(line.key, { tax_rate: v })}
              >
                <TaxOptions taxes={catalog.taxes} current={line.tax_rate} />
              </LineSelect>
              <div className="flex items-end justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                <p className="text-sm font-medium whitespace-nowrap text-zinc-900">
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

              {line.kind === "product" && (
                <LineInput
                  className="col-span-2 sm:col-span-12"
                  id={`desc-${line.key}`}
                  label="Description on the quotation"
                  value={line.description}
                  error={errors[`desc-${line.key}`]}
                  onChange={(v) => update(line.key, { description: v })}
                />
              )}
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
      <p className="mt-2 text-right text-xs text-zinc-500">
        Admin discounts are applied when invoices are generated.
      </p>
    </>
  );
}

function TaxOptions({ taxes, current }: { taxes: TaxOption[]; current: string }) {
  const rates = new Set(taxes.map((t) => rateKey(t.rate)));
  return (
    <>
      {taxes.map((t) => (
        <option key={t.id} value={rateKey(t.rate)}>
          {t.name} ({rateKey(t.rate)}%)
        </option>
      ))}
      {!rates.has("0") && <option value="0">No tax (0%)</option>}
      {current !== "0" && !rates.has(current) && (
        <option value={current}>{current}% (custom)</option>
      )}
    </>
  );
}

function ReadOnly({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="block text-xs font-medium text-zinc-600">{label}</p>
      <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
        {value}
      </p>
    </div>
  );
}

function LineSelect({
  id,
  label,
  value,
  error,
  disabled,
  onChange,
  className,
  children,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1 ${inputClass}`}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
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
