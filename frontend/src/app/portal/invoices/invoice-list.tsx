"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  InvoiceStatusBadge,
  LoadingRow,
  PageHeader,
  Pagination,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { listMyInvoices } from "@/lib/portal-api";
import { useApiData } from "@/lib/use-api-data";

const PAGE_SIZE = 20;

export default function MyInvoicesPage() {
  const [page, setPage] = useState(1);
  const list = useApiData(() => listMyInvoices(page, PAGE_SIZE), [page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My invoices"
        description="Invoices for your subscriptions, with what you've paid and what's still due."
      />

      {list.error && <Alert>{list.error}</Alert>}
      {!list.data ? (
        !list.error && <LoadingRow />
      ) : (
        <>
          <TableShell
            isEmpty={list.data.items.length === 0}
            empty="No invoices yet. They appear here once a subscription is billed."
            head={
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            }
          >
            {list.data.items.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/portal/invoices/${invoice.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {invoice.number}
                  </Link>
                  <span className="block text-xs font-normal text-zinc-500">
                    {formatDate(invoice.invoice_date)}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  <Link
                    href={`/portal/subscriptions/${invoice.subscription.id}`}
                    className="hover:text-indigo-600"
                  >
                    {invoice.subscription.number}
                  </Link>
                  <span className="block text-xs text-zinc-500">
                    {invoice.subscription.plan_name}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">
                  {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                </td>
                <td
                  className={`px-4 py-3 ${invoice.is_overdue ? "font-medium text-red-700" : "text-zinc-700"}`}
                >
                  {formatDate(invoice.due_date)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">{formatMoney(invoice.total)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">
                  {formatMoney(invoice.amount_paid)}
                </td>
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
