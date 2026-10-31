"use client";

import Link from "next/link";
import { useState } from "react";

import { BillingRunPanel } from "@/components/staff/billing-run-panel";
import {
  Alert,
  inputClass,
  InvoiceStatusBadge,
  LoadingRow,
  PageHeader,
  Pagination,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatMoney, INVOICE_STATUS_LABEL } from "@/lib/format";
import { listInvoices, type InvoiceStatus } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

const STATUSES = Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[];
const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const list = useApiData(
    () => listInvoices({ status, overdue: overdueOnly || undefined, search: query, page }),
    [status, overdueOnly, query, page],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Generated automatically from active subscriptions. Review drafts, confirm, and send."
      />

      <BillingRunPanel onDone={list.reload} />

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <div className="w-full sm:w-72">
          <label htmlFor="search" className="block text-xs font-medium text-zinc-600">
            Search
          </label>
          <input
            id="search"
            type="search"
            placeholder="Invoice number or customer email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-zinc-600">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as InvoiceStatus | "");
            }}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setPage(1);
              setOverdueOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          />
          Overdue only
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Search
        </button>
      </form>

      {list.error && <Alert>{list.error}</Alert>}
      {!list.data ? (
        !list.error && <LoadingRow />
      ) : (
        <>
          <TableShell
            isEmpty={list.data.items.length === 0}
            empty={
              query || status || overdueOnly
                ? "No invoices match these filters."
                : "No invoices yet. Activate a subscription and generate due invoices."
            }
            head={
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Due amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            }
          >
            {list.data.items.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/staff/invoices/${invoice.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {invoice.number}
                  </Link>
                  <span className="block text-xs font-normal text-zinc-500">
                    {formatDate(invoice.invoice_date)}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700">{invoice.customer.email}</td>
                <td className="px-4 py-3 text-zinc-700">
                  <Link
                    href={`/staff/subscriptions/${invoice.subscription.id}`}
                    className="hover:text-indigo-600"
                  >
                    {invoice.subscription.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(invoice.due_date)}</td>
                <td className="px-4 py-3 text-right text-zinc-900">{formatMoney(invoice.total)}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {invoice.status === "CANCELLED" ? "—" : formatMoney(invoice.amount_due)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
                </td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
