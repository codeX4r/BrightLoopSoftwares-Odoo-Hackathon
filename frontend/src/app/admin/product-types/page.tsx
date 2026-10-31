"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

export default function ProductTypesPage() {
  const notify = useNotify();
  const types = useAsyncData(adminApi.listProductTypes, []);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a product type name.");
      return;
    }
    if (trimmed.length > 100) {
      setNameError("Use 100 characters or fewer.");
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      await adminApi.createProductType(trimmed);
      setName("");
      notify("Product type added.");
      types.reload();
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Product types</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Categories such as Service or Good. Products choose one of these.
          </p>
        </div>
        <Link href="/admin/products" className={buttonClass("secondary")}>
          Back to products
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-5"
      >
        <div className="min-w-64 flex-1">
          <Field label="New product type" htmlFor="type-name" error={nameError}>
            <input
              id="type-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Service"
              aria-invalid={Boolean(nameError)}
              className={inputClass(Boolean(nameError))}
            />
          </Field>
        </div>
        <Button type="submit" loading={saving}>
          Add type
        </Button>
      </form>

      {types.loading && <LoadingState />}
      {types.error && <ErrorState message={types.error} onRetry={types.reload} />}
      {types.data && types.data.length === 0 && (
        <EmptyState
          title="No product types yet"
          description="Add one above to start creating products."
        />
      )}
      {types.data && types.data.length > 0 && (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {types.data.map((type) => (
            <li key={type.id} className="px-5 py-3 text-sm text-zinc-900">
              {type.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
