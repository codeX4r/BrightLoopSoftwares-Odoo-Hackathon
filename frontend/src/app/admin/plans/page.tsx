"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useNotify } from "@/components/admin/toast-context";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Badge, EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/feedback";
import {
  adminApi,
  FREQUENCY_LABEL,
  PLAN_STATUS_LABEL,
  type BillingFrequency,
  type Plan,
  type PlanStatus,
} from "@/lib/admin-api";
import { errorText, formatDate, formatINR } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

const STATUS_TONE: Record<PlanStatus, "green" | "amber" | "zinc"> = {
  ACTIVE: "green",
  INACTIVE: "amber",
  ARCHIVED: "zinc",
};

export default function PlansPage() {
  const notify = useNotify();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | PlanStatus>("");
  const [frequency, setFrequency] = useState<"" | BillingFrequency>("");
  const [offerable, setOfferable] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const plans = useAsyncData(
    () =>
      adminApi.listPlans({
        q,
        status: status || undefined,
        billing_frequency: frequency || undefined,
        offerable,
        limit: PAGE_SIZE,
        offset,
      }),
    [q, status, frequency, offerable, offset],
  );

  async function setPlanStatus(plan: Plan, next: PlanStatus) {
    try {
      await adminApi.updatePlan(plan.id, { status: next });
      notify(next === "ARCHIVED" ? "Plan archived." : "Plan restored.");
      plans.reload();
    } catch (err) {
      notify(errorText(err), "error");
    }
  }

  const filtersActive = Boolean(q || status || frequency || offerable);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Subscription plans
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            What customers subscribe to, how often they are billed, and when the plan is on sale.
          </p>
        </div>
        <Link href="/admin/plans/new" className={buttonClass("primary")}>
          New plan
        </Link>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 lg:grid-cols-[1fr_160px_160px_auto]">
        <input
          aria-label="Search plans"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass()}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | PlanStatus);
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          aria-label="Filter by billing frequency"
          value={frequency}
          onChange={(e) => {
            setFrequency(e.target.value as "" | BillingFrequency);
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All frequencies</option>
          {(Object.keys(FREQUENCY_LABEL) as BillingFrequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABEL[f]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={offerable}
            onChange={(e) => {
              setOfferable(e.target.checked);
              setOffset(0);
            }}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
          />
          Open for sale today
        </label>
      </div>

      {plans.loading && !plans.data && <LoadingState />}
      {plans.error && <ErrorState message={plans.error} onRetry={plans.reload} />}

      {plans.data && plans.data.total === 0 && (
        <EmptyState
          title={filtersActive ? "No plans match these filters" : "No plans yet"}
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "Create a plan from one or more products to start selling subscriptions."
          }
          action={
            !filtersActive && (
              <Link href="/admin/plans/new" className={buttonClass("primary")}>
                New plan
              </Link>
            )
          }
        />
      )}

      {plans.data && plans.data.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3 text-right">Min qty</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {plans.data.items.map((plan) => (
                <tr key={plan.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{plan.name}</p>
                    <p className="text-xs text-zinc-500">
                      {plan.product_ids.length} product{plan.product_ids.length === 1 ? "" : "s"}
                      {plan.allow_pause && " · pausable"}
                      {plan.allow_renewal && " · renewable"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatINR(plan.price)}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {FREQUENCY_LABEL[plan.billing_frequency]}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{plan.minimum_quantity}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatDate(plan.available_from)} – {formatDate(plan.available_until)}
                    {plan.is_offerable && (
                      <span className="mt-1 block">
                        <Badge tone="indigo">Open for sale</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/plans/${plan.id}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Edit
                      </Link>
                      {plan.status === "ARCHIVED" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPlanStatus(plan, "ACTIVE")}
                        >
                          Restore
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPlanStatus(plan, "ARCHIVED")}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plans.data && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={plans.data.total}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
