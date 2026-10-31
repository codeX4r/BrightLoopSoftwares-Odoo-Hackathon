"use client";

import { useId, useState, type FormEvent } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
} from "@/components/ui/feedback";
import {
  adminApi,
  PRODUCT_STATUS_LABEL,
  type ProductStatus,
  type Variant,
  type VariantInput,
} from "@/lib/admin-api";
import { errorText, formatINR, isMoney } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

/** Lists a product's variants and manages them. Final price is shown as calculated by the server. */
export function VariantsPanel({ productId }: { productId: string }) {
  const notify = useNotify();
  const variants = useAsyncData(() => adminApi.listVariants(productId), [productId]);
  const [editing, setEditing] = useState<Variant | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Variant | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleArchive(variant: Variant) {
    const next: ProductStatus = variant.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    try {
      await adminApi.updateVariant(variant.id, { status: next });
      notify(next === "ARCHIVED" ? "Variant archived." : "Variant restored.");
      variants.reload();
    } catch (err) {
      notify(errorText(err), "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteVariant(toDelete.id);
      notify("Variant deleted.");
      setToDelete(null);
      variants.reload();
    } catch (err) {
      notify(errorText(err), "error");
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Variants"
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Variants</h2>
          <p className="text-sm text-zinc-500">
            Final price = product sales price + variant additional price.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>Add variant</Button>
      </div>

      {variants.loading && !variants.data && <LoadingState />}
      {variants.error && <ErrorState message={variants.error} onRetry={variants.reload} />}
      {variants.data && variants.data.length === 0 && (
        <EmptyState
          title="No variants yet"
          description="Variants let one product be sold in options, such as a brand with an extra price."
        />
      )}
      {variants.data && variants.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4 text-right">Additional</th>
                <th className="py-2 pr-4 text-right">Final price</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {variants.data.map((variant) => (
                <tr key={variant.id}>
                  <td className="py-3 pr-4 font-medium text-zinc-900">{variant.name}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {formatINR(variant.additional_price)}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                    {formatINR(variant.final_price)}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={variant.status === "ACTIVE" ? "green" : "zinc"}>
                      {PRODUCT_STATUS_LABEL[variant.status]}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(variant)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleArchive(variant)}>
                        {variant.status === "ACTIVE" ? "Archive" : "Restore"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setToDelete(variant)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <VariantModal
          productId={productId}
          variant={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            variants.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete variant?"
        message={`"${toDelete?.name ?? ""}" will be removed from this product.`}
        confirmLabel="Delete variant"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

function VariantModal({
  productId,
  variant,
  onClose,
  onSaved,
}: {
  productId: string;
  variant?: Variant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useNotify();
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [name, setName] = useState(variant?.name ?? "");
  const [additional, setAdditional] = useState(variant?.additional_price ?? "0.00");
  const [description, setDescription] = useState(variant?.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(variant?.status ?? "ACTIVE");
  const [errors, setErrors] = useState<{ name?: string; additional?: string }>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: { name?: string; additional?: string } = {};
    if (!name.trim()) found.name = "Enter a variant name.";
    if (!isMoney(additional)) found.additional = "Use a number with up to 2 decimals, e.g. 560.00.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: VariantInput = {
      name: name.trim(),
      additional_price: additional.trim(),
      description: description.trim() || null,
      status,
    };
    setSaving(true);
    try {
      if (variant) await adminApi.updateVariant(variant.id, input);
      else await adminApi.createVariant(productId, input);
      notify(variant ? "Variant saved." : "Variant added.");
      onSaved();
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={variant ? "Edit variant" : "Add variant"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={fid("form")} loading={saving}>
            {variant ? "Save variant" : "Add variant"}
          </Button>
        </>
      }
    >
      <form id={fid("form")} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Variant name"
          htmlFor={fid("name")}
          error={errors.name}
          hint="For example: Default or Odoo."
        >
          <input
            id={fid("name")}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            className={inputClass(Boolean(errors.name))}
          />
        </Field>
        <Field
          label="Additional price (₹)"
          htmlFor={fid("additional")}
          error={errors.additional}
          hint="Added to the product's sales price. Use 0.00 for no change."
        >
          <input
            id={fid("additional")}
            inputMode="decimal"
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            aria-invalid={Boolean(errors.additional)}
            className={inputClass(Boolean(errors.additional))}
          />
        </Field>
        <Field label="Description" htmlFor={fid("description")}>
          <textarea
            id={fid("description")}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass()}
          />
        </Field>
        <Field label="Status" htmlFor={fid("status")}>
          <select
            id={fid("status")}
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
            className={inputClass()}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}
