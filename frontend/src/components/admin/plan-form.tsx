"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Button, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import {
  adminApi,
  FREQUENCY_LABEL,
  PLAN_STATUS_LABEL,
  type BillingFrequency,
  type Plan,
  type PlanInput,
  type PlanStatus,
  type Product,
} from "@/lib/admin-api";
import { errorText, isMoney } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

type Values = {
  name: string;
  description: string;
  productIds: string[];
  price: string;
  billingFrequency: BillingFrequency;
  minimumQuantity: string;
  availableFrom: string;
  availableUntil: string;
  autoCloseOnExpiry: boolean;
  allowEarlyClosure: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  status: PlanStatus;
};

type Errors = Partial<Record<keyof Values, string>>;

function initialValues(plan?: Plan): Values {
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    productIds: plan?.product_ids ?? [],
    price: plan?.price ?? "",
    billingFrequency: plan?.billing_frequency ?? "MONTHLY",
    minimumQuantity: String(plan?.minimum_quantity ?? 1),
    availableFrom: plan?.available_from ?? new Date().toISOString().slice(0, 10),
    availableUntil: plan?.available_until ?? "",
    autoCloseOnExpiry: plan?.auto_close_on_expiry ?? false,
    allowEarlyClosure: plan?.allow_early_closure ?? false,
    allowPause: plan?.allow_pause ?? false,
    allowRenewal: plan?.allow_renewal ?? false,
    status: plan?.status ?? "ACTIVE",
  };
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Enter a plan name.";
  if (values.productIds.length === 0) errors.productIds = "Choose at least one product.";
  if (!isMoney(values.price)) errors.price = "Enter a price with up to 2 decimals, e.g. 499.00.";
  const minimum = Number(values.minimumQuantity);
  if (!Number.isInteger(minimum) || minimum < 1) {
    errors.minimumQuantity = "Minimum quantity must be a whole number, 1 or more.";
  }
  if (!values.availableFrom) errors.availableFrom = "Choose a start date.";
  if (
    values.availableUntil &&
    values.availableFrom &&
    values.availableUntil < values.availableFrom
  ) {
    errors.availableUntil = "The end date can't be before the start date.";
  }
  return errors;
}

/** Create or edit a plan. The server repeats every rule, so these messages are only hints. */
export function PlanForm({ plan, onSaved }: { plan?: Plan; onSaved: (plan: Plan) => void }) {
  const notify = useNotify();
  const products = useAsyncData(() => adminApi.listProducts({ limit: 100 }), []);
  const [values, setValues] = useState<Values>(() => initialValues(plan));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleProduct(id: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      productIds: checked
        ? [...current.productIds, id]
        : current.productIds.filter((p) => p !== id),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: PlanInput = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      product_ids: values.productIds,
      price: values.price.trim(),
      billing_frequency: values.billingFrequency,
      minimum_quantity: Number(values.minimumQuantity),
      available_from: values.availableFrom,
      available_until: values.availableUntil || null,
      auto_close_on_expiry: values.autoCloseOnExpiry,
      allow_early_closure: values.allowEarlyClosure,
      allow_pause: values.allowPause,
      allow_renewal: values.allowRenewal,
      status: values.status,
    };

    setSaving(true);
    try {
      const saved = plan
        ? await adminApi.updatePlan(plan.id, input)
        : await adminApi.createPlan(input);
      notify(plan ? "Plan saved." : "Plan created.");
      onSaved(saved);
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (products.loading && !products.data) return <LoadingState />;
  if (products.error) return <ErrorState message={products.error} onRetry={products.reload} />;

  const productList: Product[] = products.data?.items ?? [];
  const archivedNotSelectable = (product: Product) =>
    product.status !== "ACTIVE" && !values.productIds.includes(product.id);

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Plan name" htmlFor="plan-name" error={errors.name}>
            <input
              id="plan-name"
              value={values.name}
              maxLength={200}
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="plan-description">
            <textarea
              id="plan-description"
              rows={3}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass()}
            />
          </Field>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-zinc-800">Products in this plan</legend>
          <div className="mt-2 grid gap-2 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2">
            {productList.length === 0 && (
              <p className="text-sm text-zinc-500">
                No products yet.{" "}
                <Link
                  href="/admin/products/new"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Create one
                </Link>{" "}
                first.
              </p>
            )}
            {productList.map((product) => (
              <Checkbox
                key={product.id}
                id={`plan-product-${product.id}`}
                label={`${product.name}${product.status === "ARCHIVED" ? " (archived)" : ""}`}
                hint={formatProductHint(product)}
                checked={values.productIds.includes(product.id)}
                disabled={archivedNotSelectable(product)}
                onChange={(checked) => toggleProduct(product.id, checked)}
              />
            ))}
          </div>
          {errors.productIds && <p className="mt-1 text-sm text-red-600">{errors.productIds}</p>}
          <p className="mt-1 text-xs text-zinc-500">Archived products can’t be added to a plan.</p>
        </fieldset>

        <Field label="Price (₹)" htmlFor="plan-price" error={errors.price}>
          <input
            id="plan-price"
            inputMode="decimal"
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="499.00"
            aria-invalid={Boolean(errors.price)}
            className={inputClass(Boolean(errors.price))}
          />
        </Field>

        <Field label="Billing frequency" htmlFor="plan-frequency">
          <select
            id="plan-frequency"
            value={values.billingFrequency}
            onChange={(e) => update("billingFrequency", e.target.value as BillingFrequency)}
            className={inputClass()}
          >
            {(Object.keys(FREQUENCY_LABEL) as BillingFrequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABEL[f]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Minimum quantity" htmlFor="plan-min-qty" error={errors.minimumQuantity}>
          <input
            id="plan-min-qty"
            inputMode="numeric"
            value={values.minimumQuantity}
            onChange={(e) => update("minimumQuantity", e.target.value)}
            aria-invalid={Boolean(errors.minimumQuantity)}
            className={inputClass(Boolean(errors.minimumQuantity))}
          />
        </Field>

        <Field label="Status" htmlFor="plan-status">
          <select
            id="plan-status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as PlanStatus)}
            className={inputClass()}
          >
            <option value="ACTIVE">{PLAN_STATUS_LABEL.ACTIVE}</option>
            <option value="INACTIVE">{PLAN_STATUS_LABEL.INACTIVE}</option>
            <option value="ARCHIVED">{PLAN_STATUS_LABEL.ARCHIVED}</option>
          </select>
        </Field>

        <Field label="Available from" htmlFor="plan-from" error={errors.availableFrom}>
          <input
            id="plan-from"
            type="date"
            value={values.availableFrom}
            onChange={(e) => update("availableFrom", e.target.value)}
            aria-invalid={Boolean(errors.availableFrom)}
            className={inputClass(Boolean(errors.availableFrom))}
          />
        </Field>

        <Field
          label="Available until"
          htmlFor="plan-until"
          error={errors.availableUntil}
          hint="Leave empty for no end date. After this date the plan can't be sold."
        >
          <input
            id="plan-until"
            type="date"
            value={values.availableUntil}
            onChange={(e) => update("availableUntil", e.target.value)}
            aria-invalid={Boolean(errors.availableUntil)}
            className={inputClass(Boolean(errors.availableUntil))}
          />
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-800">Lifecycle options</legend>
        <Checkbox
          id="plan-auto-close"
          label="Close automatically when the plan expires"
          checked={values.autoCloseOnExpiry}
          onChange={(checked) => update("autoCloseOnExpiry", checked)}
        />
        <Checkbox
          id="plan-early-close"
          label="Allow early closure"
          checked={values.allowEarlyClosure}
          onChange={(checked) => update("allowEarlyClosure", checked)}
        />
        <Checkbox
          id="plan-pause"
          label="Allow pausing"
          checked={values.allowPause}
          onChange={(checked) => update("allowPause", checked)}
        />
        <Checkbox
          id="plan-renewal"
          label="Allow renewal"
          checked={values.allowRenewal}
          onChange={(checked) => update("allowRenewal", checked)}
          hint="Stored now; subscriptions apply these options once they are built."
        />
      </fieldset>

      <div className="flex justify-end gap-3 border-t border-zinc-100 pt-5">
        <Link href="/admin/plans" className={buttonClass("secondary")}>
          Cancel
        </Link>
        <Button type="submit" loading={saving}>
          {plan ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </form>
  );
}

function formatProductHint(product: Product): string {
  return `${product.product_type.name} · ${product.status === "ACTIVE" ? "Active" : "Archived"}`;
}
