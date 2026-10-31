"use client";

import { useId, useState, type FormEvent } from "react";

import { ChoiceList } from "@/components/admin/choice-list";
import { useNotify } from "@/components/admin/toast-context";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { ErrorState, LoadingState, Modal } from "@/components/ui/feedback";
import { adminApi } from "@/lib/admin-api";
import {
  adminModulesApi,
  DISCOUNT_SCOPE_LABEL,
  DISCOUNT_TYPE_LABEL,
  type Discount,
  type DiscountInput,
  type DiscountScope,
  type DiscountType,
} from "@/lib/admin-modules-api";
import { errorText, isMoney, todayIso } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

type Values = {
  name: string;
  description: string;
  discountType: DiscountType;
  value: string;
  minPurchase: string;
  minQuantity: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  scope: DiscountScope;
  productIds: string[];
  isActive: boolean;
};

type Errors = Partial<Record<keyof Values, string>>;

const WHOLE = /^\d+$/;

function initialValues(discount?: Discount): Values {
  return {
    name: discount?.name ?? "",
    description: discount?.description ?? "",
    discountType: discount?.discount_type ?? "PERCENTAGE",
    value: discount ? String(Number(discount.value)) : "",
    minPurchase: discount?.min_purchase_amount ?? "",
    minQuantity: discount?.min_quantity ? String(discount.min_quantity) : "",
    startDate: discount?.start_date ?? todayIso(),
    endDate: discount?.end_date ?? "",
    usageLimit: discount?.usage_limit ? String(discount.usage_limit) : "",
    scope: discount?.scope ?? "ENTIRE_SUBSCRIPTION",
    productIds: discount?.products.map((p) => p.id) ?? [],
    isActive: discount?.is_active ?? true,
  };
}

function validate(values: Values, usageCount: number): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Enter a discount name.";
  else if (values.name.trim().length > 100) errors.name = "Use 100 characters or fewer.";

  if (!isMoney(values.value) || Number(values.value) <= 0) {
    errors.value = "Enter a value greater than 0, up to 2 decimals.";
  } else if (values.discountType === "PERCENTAGE" && Number(values.value) > 100) {
    errors.value = "A percentage can't be more than 100.";
  }
  if (values.minPurchase.trim() && !isMoney(values.minPurchase)) {
    errors.minPurchase = "Enter an amount with up to 2 decimals, or leave empty.";
  }
  if (values.minQuantity.trim()) {
    const n = Number(values.minQuantity);
    if (!WHOLE.test(values.minQuantity.trim()) || n < 1) {
      errors.minQuantity = "Enter a whole number of 1 or more, or leave empty.";
    }
  }
  if (!values.startDate) errors.startDate = "Choose a start date.";
  if (values.endDate && values.startDate && values.endDate < values.startDate) {
    errors.endDate = "The end date can't be before the start date.";
  }
  if (values.usageLimit.trim()) {
    const n = Number(values.usageLimit);
    if (!WHOLE.test(values.usageLimit.trim()) || n < 1) {
      errors.usageLimit = "Enter a whole number of 1 or more, or leave empty.";
    } else if (n < usageCount) {
      errors.usageLimit = `It has already been used ${usageCount} time(s).`;
    }
  }
  if (values.scope === "SPECIFIC_PRODUCTS" && values.productIds.length === 0) {
    errors.productIds = "Choose at least one product.";
  }
  return errors;
}

/** Create or edit a discount. The server repeats every rule. */
export function DiscountFormModal({
  discount,
  onClose,
  onSaved,
}: {
  discount?: Discount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useNotify();
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const products = useAsyncData(() => adminApi.listProducts({ limit: 100 }), []);
  const [values, setValues] = useState<Values>(() => initialValues(discount));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values, discount?.usage_count ?? 0);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: DiscountInput = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      discount_type: values.discountType,
      value: values.value.trim(),
      min_purchase_amount: values.minPurchase.trim() || null,
      min_quantity: values.minQuantity.trim() ? Number(values.minQuantity) : null,
      start_date: values.startDate,
      end_date: values.endDate || null,
      usage_limit: values.usageLimit.trim() ? Number(values.usageLimit) : null,
      scope: values.scope,
      product_ids: values.scope === "SPECIFIC_PRODUCTS" ? values.productIds : [],
      is_active: values.isActive,
    };
    setSaving(true);
    try {
      if (discount) await adminModulesApi.updateDiscount(discount.id, input);
      else await adminModulesApi.createDiscount(input);
      notify(discount ? "Discount saved." : "Discount created.");
      onSaved();
    } catch (err) {
      notify(errorText(err), "error");
      setSaving(false);
    }
  }

  const loading = products.loading && !products.data;

  return (
    <Modal
      open
      title={discount ? `Edit ${discount.name}` : "New discount"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={fid("form")} loading={saving} disabled={loading}>
            {discount ? "Save changes" : "Create discount"}
          </Button>
        </>
      }
    >
      {loading && <LoadingState />}
      {products.error && <ErrorState message={products.error} onRetry={products.reload} />}
      {!loading && !products.error && (
        <form id={fid("form")} onSubmit={handleSubmit} noValidate className="space-y-5">
          <Field label="Name" htmlFor={fid("name")} error={errors.name}>
            <input
              id={fid("name")}
              value={values.name}
              maxLength={100}
              placeholder="e.g. Festive 10%"
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>
          <Field label="Description" htmlFor={fid("description")}>
            <textarea
              id={fid("description")}
              rows={2}
              maxLength={2000}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass()}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Type" htmlFor={fid("type")}>
              <select
                id={fid("type")}
                value={values.discountType}
                onChange={(e) => update("discountType", e.target.value as DiscountType)}
                className={inputClass()}
              >
                {(Object.keys(DISCOUNT_TYPE_LABEL) as DiscountType[]).map((t) => (
                  <option key={t} value={t}>
                    {DISCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={values.discountType === "PERCENTAGE" ? "Value (%)" : "Value (₹)"}
              htmlFor={fid("value")}
              error={errors.value}
              hint={
                values.discountType === "FIXED"
                  ? "Never more than the amount it applies to."
                  : undefined
              }
            >
              <input
                id={fid("value")}
                inputMode="decimal"
                value={values.value}
                placeholder={values.discountType === "PERCENTAGE" ? "10" : "500.00"}
                onChange={(e) => update("value", e.target.value)}
                aria-invalid={Boolean(errors.value)}
                className={inputClass(Boolean(errors.value))}
              />
            </Field>
            <Field
              label="Minimum purchase (₹)"
              htmlFor={fid("min-purchase")}
              error={errors.minPurchase}
              hint="Pre-tax subtotal of the lines it applies to. Optional."
            >
              <input
                id={fid("min-purchase")}
                inputMode="decimal"
                value={values.minPurchase}
                onChange={(e) => update("minPurchase", e.target.value)}
                aria-invalid={Boolean(errors.minPurchase)}
                className={inputClass(Boolean(errors.minPurchase))}
              />
            </Field>
            <Field
              label="Minimum quantity"
              htmlFor={fid("min-qty")}
              error={errors.minQuantity}
              hint="Total units on those lines. Optional."
            >
              <input
                id={fid("min-qty")}
                inputMode="numeric"
                value={values.minQuantity}
                onChange={(e) => update("minQuantity", e.target.value)}
                aria-invalid={Boolean(errors.minQuantity)}
                className={inputClass(Boolean(errors.minQuantity))}
              />
            </Field>
            <Field label="Start date" htmlFor={fid("start")} error={errors.startDate}>
              <input
                id={fid("start")}
                type="date"
                value={values.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                aria-invalid={Boolean(errors.startDate)}
                className={inputClass(Boolean(errors.startDate))}
              />
            </Field>
            <Field
              label="End date"
              htmlFor={fid("end")}
              error={errors.endDate}
              hint="Last day it can be used. Leave empty for no end."
            >
              <input
                id={fid("end")}
                type="date"
                value={values.endDate}
                onChange={(e) => update("endDate", e.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                className={inputClass(Boolean(errors.endDate))}
              />
            </Field>
            <Field
              label="Usage limit"
              htmlFor={fid("limit")}
              error={errors.usageLimit}
              hint={
                discount
                  ? `Used ${discount.usage_count} time(s) so far. Leave empty for no limit.`
                  : "Invoices that can use it. Leave empty for no limit."
              }
            >
              <input
                id={fid("limit")}
                inputMode="numeric"
                value={values.usageLimit}
                onChange={(e) => update("usageLimit", e.target.value)}
                aria-invalid={Boolean(errors.usageLimit)}
                className={inputClass(Boolean(errors.usageLimit))}
              />
            </Field>
            <Field label="Applies to" htmlFor={fid("scope")}>
              <select
                id={fid("scope")}
                value={values.scope}
                onChange={(e) => update("scope", e.target.value as DiscountScope)}
                className={inputClass()}
              >
                {(Object.keys(DISCOUNT_SCOPE_LABEL) as DiscountScope[]).map((s) => (
                  <option key={s} value={s}>
                    {DISCOUNT_SCOPE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {values.scope === "SPECIFIC_PRODUCTS" && (
            <ChoiceList
              legend="Products"
              choices={(products.data?.items ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                hint: p.product_type.name,
              }))}
              selected={values.productIds}
              onChange={(ids) => update("productIds", ids)}
              emptyText="No products yet."
              error={errors.productIds}
              hint="Only lines for these products count toward the minimums and the discount."
            />
          )}

          <Checkbox
            id={fid("active")}
            label="Active"
            hint="Inactive discounts are never applied. Usage history is kept."
            checked={values.isActive}
            onChange={(checked) => update("isActive", checked)}
          />
        </form>
      )}
    </Modal>
  );
}
