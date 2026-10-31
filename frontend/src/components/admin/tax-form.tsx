"use client";

import { useId, useState, type FormEvent } from "react";

import { ChoiceList } from "@/components/admin/choice-list";
import { useNotify } from "@/components/admin/toast-context";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { ErrorState, LoadingState, Modal } from "@/components/ui/feedback";
import { adminApi } from "@/lib/admin-api";
import { adminModulesApi, type Tax, type TaxInput } from "@/lib/admin-modules-api";
import { errorText } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

type Values = {
  name: string;
  rate: string;
  taxType: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  productIds: string[];
  productTypeIds: string[];
};

type Errors = Partial<Record<"name" | "rate" | "taxType" | "isDefault", string>>;

/** 0 to 100 with at most two decimals, matching the backend Rate type. */
function isRate(value: string): boolean {
  const text = value.trim();
  return /^\d{1,3}(\.\d{1,2})?$/.test(text) && Number(text) <= 100;
}

function initialValues(tax?: Tax): Values {
  return {
    name: tax?.name ?? "",
    rate: tax ? String(Number(tax.rate)) : "",
    taxType: tax?.tax_type ?? "GST",
    description: tax?.description ?? "",
    isActive: tax?.is_active ?? true,
    isDefault: tax?.is_default ?? false,
    productIds: tax?.products.map((p) => p.id) ?? [],
    productTypeIds: tax?.product_types.map((t) => t.id) ?? [],
  };
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Enter a tax name.";
  else if (values.name.trim().length > 100) errors.name = "Use 100 characters or fewer.";
  if (!isRate(values.rate)) errors.rate = "Enter a rate from 0 to 100, up to 2 decimals.";
  if (!values.taxType.trim()) errors.taxType = "Enter a tax type, e.g. GST.";
  else if (values.taxType.trim().length > 50) errors.taxType = "Use 50 characters or fewer.";
  if (values.isDefault && !values.isActive) errors.isDefault = "The default tax must be active.";
  return errors;
}

/** Create or edit a tax. The server repeats every rule; these checks only give early hints. */
export function TaxFormModal({
  tax,
  onClose,
  onSaved,
}: {
  tax?: Tax;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useNotify();
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const products = useAsyncData(() => adminApi.listProducts({ limit: 100 }), []);
  const types = useAsyncData(adminApi.listProductTypes, []);
  const [values, setValues] = useState<Values>(() => initialValues(tax));
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

    const input: TaxInput = {
      name: values.name.trim(),
      rate: values.rate.trim(),
      tax_type: values.taxType.trim(),
      description: values.description.trim() || null,
      is_active: values.isActive,
      is_default: values.isDefault,
      product_ids: values.productIds,
      product_type_ids: values.productTypeIds,
    };
    setSaving(true);
    try {
      if (tax) await adminModulesApi.updateTax(tax.id, input);
      else await adminModulesApi.createTax(input);
      notify(tax ? "Tax saved." : "Tax created.");
      onSaved();
    } catch (err) {
      notify(errorText(err), "error");
      setSaving(false);
    }
  }

  const loading = (products.loading && !products.data) || (types.loading && !types.data);
  const loadError = products.error ?? types.error;

  return (
    <Modal
      open
      title={tax ? `Edit ${tax.name}` : "New tax"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={fid("form")} loading={saving} disabled={loading}>
            {tax ? "Save changes" : "Create tax"}
          </Button>
        </>
      }
    >
      {loading && <LoadingState />}
      {loadError && (
        <ErrorState
          message={loadError}
          onRetry={() => {
            products.reload();
            types.reload();
          }}
        />
      )}
      {!loading && !loadError && (
        <form id={fid("form")} onSubmit={handleSubmit} noValidate className="space-y-5">
          <Field label="Name" htmlFor={fid("name")} error={errors.name}>
            <input
              id={fid("name")}
              value={values.name}
              maxLength={100}
              placeholder="e.g. GST 5%"
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Rate (%)" htmlFor={fid("rate")} error={errors.rate}>
              <input
                id={fid("rate")}
                inputMode="decimal"
                value={values.rate}
                placeholder="5"
                onChange={(e) => update("rate", e.target.value)}
                aria-invalid={Boolean(errors.rate)}
                className={inputClass(Boolean(errors.rate))}
              />
            </Field>
            <Field label="Tax type" htmlFor={fid("type")} error={errors.taxType}>
              <input
                id={fid("type")}
                value={values.taxType}
                maxLength={50}
                placeholder="GST"
                onChange={(e) => update("taxType", e.target.value)}
                aria-invalid={Boolean(errors.taxType)}
                className={inputClass(Boolean(errors.taxType))}
              />
            </Field>
          </div>
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

          <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
            <Checkbox
              id={fid("active")}
              label="Active"
              hint="Inactive taxes are kept for history but never applied to new quotations."
              checked={values.isActive}
              onChange={(checked) => update("isActive", checked)}
            />
            <Checkbox
              id={fid("default")}
              label="Default tax"
              hint="Applies to products that have no product or product-type tax. Only one tax can be the default; choosing this one replaces the current default."
              checked={values.isDefault}
              disabled={tax?.is_default}
              onChange={(checked) => update("isDefault", checked)}
            />
            {tax?.is_default && (
              <p className="text-xs text-zinc-500">
                To change the default, mark a different tax as default.
              </p>
            )}
            {errors.isDefault && <p className="text-sm text-red-600">{errors.isDefault}</p>}
          </div>

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
            hint="A product's own tax wins over its product type's tax and the default. If several active taxes list the same product, the first by name is used."
          />
          <ChoiceList
            legend="Product types"
            choices={(types.data ?? []).map((t) => ({ id: t.id, name: t.name }))}
            selected={values.productTypeIds}
            onChange={(ids) => update("productTypeIds", ids)}
            emptyText="No product types yet."
          />
        </form>
      )}
    </Modal>
  );
}
