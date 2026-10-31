"use client";

import { useEffect, useState } from "react";

import { TaxFormModal } from "@/components/admin/tax-form";
import { useNotify } from "@/components/admin/toast-context";
import { Button } from "@/components/ui/button";
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { adminModulesApi, type Tax } from "@/lib/admin-modules-api";
import { errorText } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

function appliesTo(tax: Tax): string {
  const parts: string[] = [];
  if (tax.products.length > 0) {
    parts.push(`${tax.products.length} product${tax.products.length === 1 ? "" : "s"}`);
  }
  if (tax.product_types.length > 0) {
    parts.push(
      `${tax.product_types.length} product type${tax.product_types.length === 1 ? "" : "s"}`,
    );
  }
  if (tax.is_default) parts.push("everything else (default)");
  return parts.length > 0 ? parts.join(", ") : "Not linked yet";
}

export default function TaxesPage() {
  const notify = useNotify();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Tax | "new" | null>(null);
  const [toggling, setToggling] = useState<Tax | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const taxes = useAsyncData(
    () =>
      adminModulesApi.listTaxes({
        q,
        is_active: active === "" ? undefined : active === "true",
        limit: PAGE_SIZE,
        offset,
      }),
    [q, active, offset],
  );

  async function makeDefault(tax: Tax) {
    try {
      await adminModulesApi.updateTax(tax.id, { is_default: true });
      notify(`${tax.name} is now the default tax.`);
      taxes.reload();
    } catch (err) {
      notify(errorText(err), "error");
    }
  }

  async function confirmToggle() {
    if (!toggling) return;
    setBusy(true);
    try {
      await adminModulesApi.updateTax(toggling.id, { is_active: !toggling.is_active });
      notify(toggling.is_active ? "Tax deactivated." : "Tax activated.");
      taxes.reload();
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setBusy(false);
      setToggling(null);
    }
  }

  const filtersActive = Boolean(q || active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Taxes</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Percentage taxes on quotation and invoice lines. A product uses its own tax first,
            then its product type&apos;s tax, then the default tax. Taxes are never deleted, only
            deactivated, so past invoices keep their rate.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>New tax</Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_180px]">
        <input
          aria-label="Search taxes"
          type="search"
          placeholder="Search by name or type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass()}
        />
        <select
          aria-label="Filter by status"
          value={active}
          onChange={(e) => {
            setActive(e.target.value as "" | "true" | "false");
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All taxes</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {taxes.loading && !taxes.data && <LoadingState />}
      {taxes.error && <ErrorState message={taxes.error} onRetry={taxes.reload} />}

      {taxes.data && taxes.data.total === 0 && (
        <EmptyState
          title={filtersActive ? "No taxes match these filters" : "No taxes yet"}
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "Create a tax and mark it as the default."
          }
          action={!filtersActive && <Button onClick={() => setEditing("new")}>New tax</Button>}
        />
      )}

      {taxes.data && taxes.data.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Applies to</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {taxes.data.items.map((tax) => (
                <tr key={tax.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900">{tax.name}</span>
                    {tax.is_default && (
                      <span className="ml-2">
                        <Badge tone="indigo">Default</Badge>
                      </span>
                    )}
                    {tax.description && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-500">
                        {tax.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(tax.rate)}%</td>
                  <td className="px-4 py-3 text-zinc-600">{tax.tax_type}</td>
                  <td className="px-4 py-3 text-zinc-600">{appliesTo(tax)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={tax.is_active ? "green" : "zinc"}>
                      {tax.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(tax)}>
                        Edit
                      </Button>
                      {tax.is_active && !tax.is_default && (
                        <Button variant="ghost" size="sm" onClick={() => makeDefault(tax)}>
                          Make default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={tax.is_default}
                        title={
                          tax.is_default
                            ? "Choose another default before deactivating this tax."
                            : undefined
                        }
                        onClick={() => setToggling(tax)}
                      >
                        {tax.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {taxes.data && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={taxes.data.total}
          onChange={setOffset}
        />
      )}

      {editing !== null && (
        <TaxFormModal
          tax={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            taxes.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "Deactivate tax?" : "Activate tax?"}
        message={
          toggling?.is_active
            ? `${toggling.name} won't be offered or applied to new quotations. Existing invoices keep the rate they were issued with.`
            : `${toggling?.name ?? ""} will be applied again to the products and types it is linked to.`
        }
        confirmLabel={toggling?.is_active ? "Deactivate" : "Activate"}
        busy={busy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </div>
  );
}
