"use client";

import { useId, useState } from "react";

import { Panel, Stat } from "@/components/admin/detail-ui";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Field, inputClass } from "@/components/ui/field";
import {
  adminModulesApi,
  type GroupBy,
  type RevenuePeriod,
  type RevenueReport,
} from "@/lib/admin-modules-api";
import { FREQUENCY_LABEL, SUBSCRIPTION_STATUS_LABEL, formatDate, formatINR, todayIso } from "@/lib/format";
import type { BillingFrequency, SubscriptionStatus } from "@/lib/staff-api";
import { useAsyncData } from "@/lib/use-async-data";

const monthName = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

function periodLabel(p: RevenuePeriod): string {
  return p.month ? monthName.format(new Date(p.year, p.month - 1, 1)) : String(p.year);
}

function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(d, last));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type Preset = "month" | "year" | "12m";

function presetRange(preset: Preset, today: string) {
  const [y, m] = today.split("-");
  if (preset === "month") return { date_from: `${y}-${m}-01`, date_to: today };
  if (preset === "year") return { date_from: `${y}-01-01`, date_to: today };
  return { date_from: shiftMonths(today, -12), date_to: today };
}

/** Builds a CSV of the period rows and starts a download in the browser. */
function downloadCsv(report: RevenueReport) {
  const rows = [
    ["Period", "Invoiced (INR)", "Invoices", "Received (INR)", "Payments"],
    ...report.periods.map((p) => [
      periodLabel(p),
      p.invoiced,
      String(p.invoices_count),
      p.received,
      String(p.payments_count),
    ]),
    ["Total", report.invoiced, String(report.invoices_count), report.received, String(report.payments_count)],
  ];
  const text = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `revenue_${report.date_from}_${report.date_to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const uid = useId();
  const today = todayIso();
  const [range, setRange] = useState(() => presetRange("year", today));
  const [draft, setDraft] = useState(range);
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const revenue = useAsyncData(
    () => adminModulesApi.revenueReport(range, groupBy),
    [range.date_from, range.date_to, groupBy],
  );
  const subs = useAsyncData(
    () => adminModulesApi.subscriptionReport(range),
    [range.date_from, range.date_to],
  );

  function apply(next: { date_from: string; date_to: string }) {
    if (!next.date_from || !next.date_to) {
      setRangeError("Choose both dates.");
      return;
    }
    if (next.date_from > next.date_to) {
      setRangeError("The start date must be on or before the end date.");
      return;
    }
    setRangeError(null);
    setDraft(next);
    setRange(next);
  }

  const r = revenue.data;
  const s = subs.data;
  const maxBar = r
    ? Math.max(1, ...r.periods.flatMap((p) => [Number(p.invoiced), Number(p.received)]))
    : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Invoiced is what was billed (confirmed or paid invoices, by invoice date). Received is cash
          collected (payments, by payment date). Outstanding and overdue are as of today. Amounts
          include tax, in INR.
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4"
      >
        <div className="w-40">
          <Field label="From" htmlFor={`${uid}-from`}>
            <input
              id={`${uid}-from`}
              type="date"
              value={draft.date_from}
              max={draft.date_to || undefined}
              onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
              className={inputClass(Boolean(rangeError))}
            />
          </Field>
        </div>
        <div className="w-40">
          <Field label="To" htmlFor={`${uid}-to`}>
            <input
              id={`${uid}-to`}
              type="date"
              value={draft.date_to}
              min={draft.date_from || undefined}
              onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
              className={inputClass(Boolean(rangeError))}
            />
          </Field>
        </div>
        <div className="w-36">
          <Field label="Group by" htmlFor={`${uid}-group`}>
            <select
              id={`${uid}-group`}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className={inputClass()}
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </Field>
        </div>
        <Button type="submit">Apply</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => apply(presetRange("month", today))}>
            This month
          </Button>
          <Button variant="ghost" size="sm" onClick={() => apply(presetRange("year", today))}>
            This year
          </Button>
          <Button variant="ghost" size="sm" onClick={() => apply(presetRange("12m", today))}>
            Last 12 months
          </Button>
        </div>
        {rangeError && (
          <p role="alert" className="w-full text-sm text-red-600">
            {rangeError}
          </p>
        )}
      </form>

      <p className="text-sm text-zinc-500">
        Showing {formatDate(range.date_from)} – {formatDate(range.date_to)}
      </p>

      {revenue.loading && !r && <LoadingState />}
      {revenue.error && <ErrorState message={revenue.error} onRetry={revenue.reload} />}

      {r && (
        <>
          <section aria-label="Revenue summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Invoiced" value={formatINR(r.invoiced)}>
              {r.invoices_count} invoice{r.invoices_count === 1 ? "" : "s"} issued in this range
            </Stat>
            <Stat label="Received" value={formatINR(r.received)}>
              {r.payments_count} payment{r.payments_count === 1 ? "" : "s"} in this range
            </Stat>
            <Stat label="Outstanding today" value={formatINR(r.outstanding)}>
              {r.outstanding_count} unpaid invoice{r.outstanding_count === 1 ? "" : "s"}, any date
            </Stat>
            <Stat label="Overdue today" value={formatINR(r.overdue)}>
              {r.overdue_count > 0 ? (
                <span className="text-red-600">{r.overdue_count} past their due date</span>
              ) : (
                "Nothing overdue"
              )}
            </Stat>
          </section>

          <Panel title={groupBy === "month" ? "Invoiced and received by month" : "Invoiced and received by year"}>
            {r.periods.length === 0 ? (
              <EmptyState
                title="No invoices or payments in this range"
                description="Pick a wider date range, or come back after billing runs."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" aria-hidden="true" />
                      Invoiced
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" />
                      Received
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => downloadCsv(r)}>
                    Download CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-zinc-700">
                    <thead className="text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                      <tr>
                        <th className="w-28 px-2 py-2">Period</th>
                        <th className="min-w-48 px-2 py-2">Chart</th>
                        <th className="px-2 py-2 text-right">Invoiced</th>
                        <th className="px-2 py-2 text-right">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {r.periods.map((p) => (
                        <tr key={`${p.year}-${p.month ?? 0}`}>
                          <td className="px-2 py-2 whitespace-nowrap">{periodLabel(p)}</td>
                          <td className="px-2 py-2" aria-hidden="true">
                            <div className="space-y-1">
                              <div
                                className="h-2.5 rounded-sm bg-indigo-500"
                                style={{ width: `${(Number(p.invoiced) / maxBar) * 100}%` }}
                              />
                              <div
                                className="h-2.5 rounded-sm bg-emerald-500"
                                style={{ width: `${(Number(p.received) / maxBar) * 100}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                            {formatINR(p.invoiced)}
                            <span className="block text-xs text-zinc-500">
                              {p.invoices_count} invoice{p.invoices_count === 1 ? "" : "s"}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                            {formatINR(p.received)}
                            <span className="block text-xs text-zinc-500">
                              {p.payments_count} payment{p.payments_count === 1 ? "" : "s"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>
        </>
      )}

      {subs.loading && !s && <LoadingState />}
      {subs.error && <ErrorState message={subs.error} onRetry={subs.reload} />}

      {s && (
        <>
          <section
            aria-label="Subscription summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Stat label="New subscriptions" value={String(s.new_subscriptions)}>
              Activated in this range
            </Stat>
            <Stat label="Closed" value={String(s.closed_subscriptions)}>
              Closed in this range
            </Stat>
            <Stat label="Expired" value={String(s.expired_subscriptions)}>
              Reached their expiry date in this range
            </Stat>
            <Stat
              label="Renewed"
              value={s.renewed_subscriptions === null ? "—" : String(s.renewed_subscriptions)}
            >
              {s.renewed_subscriptions === null ? "Renewals are not tracked yet" : "In this range"}
            </Stat>
            <Stat label="Active now" value={String(s.active_subscriptions)} />
            <Stat label="Open quotations" value={String(s.open_quotations)}>
              Sent, waiting for the customer
            </Stat>
            <Stat label="Awaiting activation" value={String(s.awaiting_activation)}>
              Confirmed, not yet active
            </Stat>
          </section>

          <Panel title="Recurring revenue">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">
                {formatINR(s.recurring_revenue_monthly)}
              </p>
              <span className="text-sm text-zinc-500">per month, before tax</span>
              <Badge tone="amber">Proposed definition</Badge>
            </div>
            <p className="max-w-3xl text-sm text-zinc-600">{s.recurring_revenue_definition}</p>
            {Object.keys(s.recurring_by_frequency).length > 0 && (
              <dl className="grid gap-3 text-sm sm:grid-cols-4">
                {Object.entries(s.recurring_by_frequency).map(([freq, total]) => (
                  <div key={freq} className="rounded-lg bg-zinc-50 p-3">
                    <dt className="text-zinc-500">
                      {FREQUENCY_LABEL[freq as BillingFrequency] ?? freq} billing
                    </dt>
                    <dd className="font-semibold tabular-nums">{formatINR(total)} per cycle</dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <Panel title="Subscriptions by status (all time)">
            <dl className="grid gap-3 text-sm sm:grid-cols-5">
              {Object.entries(s.status_counts).map(([status, count]) => (
                <div key={status} className="rounded-lg bg-zinc-50 p-3">
                  <dt className="text-zinc-500">
                    {SUBSCRIPTION_STATUS_LABEL[status as SubscriptionStatus] ?? status}
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums">{count}</dd>
                </div>
              ))}
              {Object.keys(s.status_counts).length === 0 && (
                <p className="text-zinc-500">No subscriptions yet.</p>
              )}
            </dl>
          </Panel>
        </>
      )}
    </div>
  );
}
