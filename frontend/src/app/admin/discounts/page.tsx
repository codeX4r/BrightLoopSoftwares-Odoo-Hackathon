"use client";

import { useEffect, useId, useState } from "react";

import { DiscountFormModal } from "@/components/admin/discount-form";
import { DiscountPreviewPanel } from "@/components/admin/discount-preview";
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
import { Checkbox, inputClass } from "@/components/ui/field";
import { adminApi } from "@/lib/admin-api";
import {
  adminModulesApi,
  DISCOUNT_SCOPE_LABEL,
  type Discount,
  type DiscountType,
} from "@/lib/admin-modules-api";
import { errorText, formatDate, formatINR, todayIso } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

function valueText(d: Discount): string {
  return d.discount_type === "PERCENTAGE" ? `${Number(d.value)}%` : formatINR(d.value);
}

/** Why an active discount can't be used today, or that it can. */
function availability(d: Discount, today: string): { label: string; tone: "green" | "amber" | "zinc" } {
  if (!d.is_active) return { label: "Inactive", tone: "zinc" };
  if (d.is_valid_today) return { label: "Valid today", tone: "green" };
  if (d.start_date > today) return { label: `Starts ${formatDate(d.start_date)}`, tone: "amber" };
  if (d.end_date && d.end_date < today) return { label: "Ended", tone: "zinc" };
  if (d.usage_limit !== null && d.usage_count >= d.usage_limit) {
    return { label: "Used up", tone: "zinc" };
  }
  return { label: "Not valid today", tone: "amber" };
}

function conditions(d: Discount): string {
  const parts: string[] = [];
  if (d.min_purchase_amount) parts.push(`Min ${formatINR(d.min_purchase_amount)}`);
  if (d.min_quantity) parts.push(`Min qty ${d.min_quantity}`);
  return parts.length > 0 ? parts.join(" · ") : "None";
}

export default function DiscountsPage() {
  const notify = useNotify();
  const today = todayIso();
  const validTodayId = useId();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [type, setType] = useState<"" | DiscountType>("");
  const [validToday, setValidToday] = useState(false);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const [toggling, setToggling] = useState<Discount | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const discounts = useAsyncData(
    () =>
      adminModulesApi.listDiscounts({
        q,
        is_active: active === "" ? undefined : active === "true",
        discount_type: type || undefined,
        valid_today: validToday || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    [q, active, type, validToday, offset],
  );
  const products = useAsyncData(() => adminApi.listProducts({ limit: 100 }), []);

  async function confirmToggle() {
    if (!toggling) return;
    setBusy(true);
    try {
      await adminModulesApi.updateDiscount(toggling.id, { is_active: !toggling.is_active });
      notify(toggling.is_active ? "Discount deactivated." : "Discount activated.");
      discounts.reload();
    } catch (err) {
      notify(errorText(err), "error");
    } finally {
      setBusy(false);
      setToggling(null);
    }
  }

  const filtersActive = Boolean(q || active || type || validToday);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Discounts</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Fixed or percentage reductions on the pre-tax subtotal. Discounts don&apos;t stack: an
            invoice gets the single discount with the largest reduction. Invoices don&apos;t apply
            discounts yet; once billing does, a use is counted when the invoice is confirmed.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>New discount</Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_160px_170px_auto] sm:items-center">
        <input
          aria-label="Search discounts"
          type="search"
          placeholder="Search by name"
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
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          aria-label="Filter by type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as "" | DiscountType);
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All types</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
        <Checkbox
          id={validTodayId}
          label="Valid today"
          checked={validToday}
          onChange={(checked) => {
            setValidToday(checked);
            setOffset(0);
          }}
        />
      </div>

      {discounts.loading && !discounts.data && <LoadingState />}
      {discounts.error && <ErrorState message={discounts.error} onRetry={discounts.reload} />}

      {discounts.data && discounts.data.total === 0 && (
        <EmptyState
          title={filtersActive ? "No discounts match these filters" : "No discounts yet"}
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "Create a discount to reward larger or longer subscriptions."
          }
          action={
            !filtersActive && <Button onClick={() => setEditing("new")}>New discount</Button>
          }
        />
      )}

      {discounts.data && discounts.data.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3">Conditions</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3">Applies to</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {discounts.data.items.map((d) => {
                const state = availability(d, today);
                return (
                  <tr key={d.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{d.name}</span>
                      {d.description && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-500">
                          {d.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{valueText(d)}</td>
                    <td className="px-4 py-3 text-zinc-600">{conditions(d)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                      {formatDate(d.start_date)} – {d.end_date ? formatDate(d.end_date) : "no end"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.usage_count}
                      {d.usage_limit !== null && ` / ${d.usage_limit}`}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {d.scope === "SPECIFIC_PRODUCTS"
                        ? d.products.map((p) => p.name).join(", ")
                        : DISCOUNT_SCOPE_LABEL[d.scope]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(d)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setToggling(d)}>
                          {d.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {discounts.data && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={discounts.data.total}
          onChange={setOffset}
        />
      )}

      <DiscountPreviewPanel products={products.data?.items ?? []} />

      {editing !== null && (
        <DiscountFormModal
          discount={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            discounts.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.is_active ? "Deactivate discount?" : "Activate discount?"}
        message={
          toggling?.is_active
            ? `${toggling.name} won't be applied to new invoices. Its usage history is kept.`
            : `${toggling?.name ?? ""} can be applied again while it is inside its dates and usage limit.`
        }
        confirmLabel={toggling?.is_active ? "Deactivate" : "Activate"}
        busy={busy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </div>
  );
}
