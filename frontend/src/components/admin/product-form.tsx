"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import {
  adminApi,
  PRODUCT_STATUS_LABEL,
  type Product,
  type ProductInput,
  type ProductStatus,
  type ProductType,
} from "@/lib/admin-api";
import { errorText, isMoney } from "@/lib/format";

type Values = {
  name: string;
  productTypeId: string;
  salesPrice: string;
  costPrice: string;
  description: string;
  status: ProductStatus;
};

type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values, productTypeCount: number): Errors {
  const errors: Errors = {};
  const name = values.name.trim();
  if (!name) errors.name = "Enter a product name.";
  else if (name.length > 200) errors.name = "Use 200 characters or fewer.";
  if (!values.productTypeId) {
    errors.productTypeId =
      productTypeCount === 0 ? "Create a product type first." : "Choose a product type.";
  }
  if (!values.salesPrice.trim()) errors.salesPrice = "Enter a sales price.";
  else if (!isMoney(values.salesPrice))
    errors.salesPrice = "Use a number with up to 2 decimals, e.g. 2000.00.";
  if (!values.costPrice.trim()) errors.costPrice = "Enter a cost price.";
  else if (!isMoney(values.costPrice))
    errors.costPrice = "Use a number with up to 2 decimals, e.g. 900.00.";
  if (values.description.length > 2000) errors.description = "Use 2000 characters or fewer.";
  return errors;
}

/** Create or edit a product. The server repeats every check, so errors here are only hints. */
export function ProductForm({
  product,
  productTypes,
  onSaved,
}: {
  product?: Product;
  productTypes: ProductType[];
  onSaved: (product: Product) => void;
}) {
  const notify = useNotify();
  // Unique per instance: Next.js keeps previous pages mounted (hidden), so fixed ids
  // would collide and labels could point at a hidden page's input.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [values, setValues] = useState<Values>({
    name: product?.name ?? "",
    productTypeId: product?.product_type.id ?? "",
    salesPrice: product?.sales_price ?? "",
    costPrice: product?.cost_price ?? "",
    description: product?.description ?? "",
    status: product?.status ?? "ACTIVE",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values, productTypes.length);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: ProductInput = {
      name: values.name.trim(),
      product_type_id: values.productTypeId,
      sales_price: values.salesPrice.trim(),
      cost_price: values.costPrice.trim(),
      description: values.description.trim() || null,
      status: values.status,
    };

    setSaving(true);
    try {
      const saved = product
        ? await adminApi.updateProduct(product.id, input)
        : await adminApi.createProduct(input);
      notify(product ? "Product saved." : "Product created.");
      onSaved(saved);
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Product name" htmlFor={fid("name")} error={errors.name}>
            <input
              id={fid("name")}
              value={values.name}
              maxLength={200}
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>
        </div>

        <Field
          label="Product type"
          htmlFor={fid("type")}
          error={errors.productTypeId}
          hint={productTypes.length === 0 ? undefined : undefined}
        >
          <select
            id={fid("type")}
            value={values.productTypeId}
            onChange={(e) => update("productTypeId", e.target.value)}
            aria-invalid={Boolean(errors.productTypeId)}
            className={inputClass(Boolean(errors.productTypeId))}
          >
            <option value="">Select a type</option>
            {productTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Need another type?{" "}
            <Link
              href="/admin/product-types"
              className="font-medium text-indigo-600 hover:underline"
            >
              Manage product types
            </Link>
          </p>
        </Field>

        <Field label="Status" htmlFor={fid("status")}>
          <select
            id={fid("status")}
            value={values.status}
            onChange={(e) => update("status", e.target.value as ProductStatus)}
            className={inputClass()}
          >
            {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Sales price (₹)"
          htmlFor={fid("sales")}
          error={errors.salesPrice}
          hint="Price customers pay, before tax."
        >
          <input
            id={fid("sales")}
            inputMode="decimal"
            value={values.salesPrice}
            onChange={(e) => update("salesPrice", e.target.value)}
            placeholder="2000.00"
            aria-invalid={Boolean(errors.salesPrice)}
            className={inputClass(Boolean(errors.salesPrice))}
          />
        </Field>

        <Field
          label="Cost price (₹)"
          htmlFor={fid("cost")}
          error={errors.costPrice}
          hint="What the product costs Brightloop."
        >
          <input
            id={fid("cost")}
            inputMode="decimal"
            value={values.costPrice}
            onChange={(e) => update("costPrice", e.target.value)}
            placeholder="900.00"
            aria-invalid={Boolean(errors.costPrice)}
            className={inputClass(Boolean(errors.costPrice))}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Description / notes"
            htmlFor={fid("description")}
            error={errors.description}
          >
            <textarea
              id={fid("description")}
              rows={4}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass(Boolean(errors.description))}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-zinc-100 pt-5">
        <Link href="/admin/products" className={buttonClass("secondary")}>
          Cancel
        </Link>
        <Button type="submit" loading={saving}>
          {product ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
