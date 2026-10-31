"use client";

import Link from "next/link";
import { useState } from "react";

import { BillingRunPanel } from "@/components/staff/billing-run-panel";
import {
  Alert,
  Card,
  inputClass,
  InvoiceStatusBadge,
  LoadingRow,
  PageHeader,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getStaffDashboard, listInvoices, type ActivityItem } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function StaffDashboardPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const dashboard = useApiData(
    () =>
      rangeInvalid
        ? Promise.reject(new Error("range"))
        : getStaffDashboard({ date_from: dateFrom, date_to: dateTo }),
    [dateFrom, dateTo, rangeInvalid],
  );
  const overdue = useApiData(() => listInvoices({ overdue: true }), []);
  const d = dashboard.data;

  function reloadAll() {
    dashboard.reload();
    overdue.reload();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Subscriptions, revenue and outstanding invoices at a glance."
      />

      <Card title="Revenue period">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="date-from" className="block text-xs font-medium text-zinc-600">
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="date-to" className="block text-xs font-medium text-zinc-600">
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-invalid={rangeInvalid}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="pb-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Clear (all time)
            </button>
          )}
        </div>
        {rangeInvalid && (
          <p className="mt-2 text-sm text-red-600">The start date must be before the end date.</p>
        )}
      </Card>

      {dashboard.error && !rangeInvalid && <Alert>{dashboard.error}</Alert>}

      {!d ? (
        !dashboard.error && <LoadingRow />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total customers"
            value={String(d.total_customers)}
            sub={`${d.active_customers} active`}
          />
          <Stat
            label="Active subscriptions"
            value={String(d.active_subscriptions)}
            href="/staff/subscriptions"
          />
          <Stat
            label="Revenue received"
            value={formatMoney(d.revenue_received)}
            sub={`${d.payments_count} payment${d.payments_count === 1 ? "" : "s"}${d.date_from || d.date_to ? " in period" : ", all time"}`}
            tone="good"
          />
          <Stat
            label="Outstanding"
            value={formatMoney(d.outstanding_amount)}
            sub={`${d.outstanding_invoices} confirmed invoice${d.outstanding_invoices === 1 ? "" : "s"}`}
          />
          <Stat
            label="Overdue"
            value={formatMoney(d.overdue_amount)}
            sub={`${d.overdue_invoices} invoice${d.overdue_invoices === 1 ? "" : "s"} past due`}
            tone={d.overdue_invoices > 0 ? "bad" : undefined}
          />
          <Stat label="Open quotations" value={String(d.open_quotations)} />
          <Stat label="Confirmed, not yet active" value={String(d.awaiting_activation)} />
          <Stat
            label="Draft invoices to review"
            value={String(d.draft_invoices)}
            tone={d.draft_invoices > 0 ? "warn" : undefined}
          />
        </div>
      )}

      <BillingRunPanel onDone={reloadAll} />

      {d && <RecentActivity items={d.recent_activity} />}

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-900">Overdue invoices</h2>
        {overdue.error && <Alert>{overdue.error}</Alert>}
        {!overdue.data ? (
          !overdue.error && <LoadingRow />
        ) : (
          <TableShell
            isEmpty={overdue.data.items.length === 0}
            empty="No overdue invoices."
            head={
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Amount due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            }
          >
            {overdue.data.items.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/staff/invoices/${invoice.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {invoice.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">{invoice.customer.email}</td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(invoice.due_date)}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {formatMoney(invoice.amount_due)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
                </td>
              </tr>
            ))}
          </TableShell>
        )}
      </section>
    </div>
  );
}

const ACTIVITY_DOT: Record<ActivityItem["kind"], string> = {
  subscription_created: "bg-zinc-400",
  quotation_sent: "bg-amber-500",
  quotation_accepted: "bg-sky-500",
  subscription_activated: "bg-emerald-500",
  subscription_closed: "bg-zinc-400",
  invoice_generated: "bg-indigo-400",
  invoice_confirmed: "bg-sky-500",
  invoice_paid: "bg-emerald-500",
  invoice_cancelled: "bg-red-400",
  payment_recorded: "bg-emerald-500",
};

function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card title="Recent activity">
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing yet. Quotations, invoices and payments will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.target_id}-${index}`}>
              <Link
                href={`/staff/${item.target === "invoice" ? "invoices" : "subscriptions"}/${item.target_id}`}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTIVITY_DOT[item.kind]}`}
                />
                <span className="min-w-0 flex-1 text-sm text-zinc-800">{item.message}</span>
                <span className="shrink-0 text-xs text-zinc-500">{formatDateTime(item.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const valueColor =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-red-700"
        : tone === "warn"
          ? "text-amber-700"
          : "text-zinc-900";
  const body = (
    <>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </>
  );
  const className = "block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm";
  return href ? (
    <Link href={href} className={`${className} transition hover:border-indigo-300`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
