"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  inputClass,
  LoadingRow,
  PageHeader,
  Pagination,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { listPayments, type PaymentMethod } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

const METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[];
const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const list = useApiData(
    () => listPayments({ method, date_from: dateFrom, date_to: dateTo, page }),
    [method, dateFrom, dateTo, page],
  );
  const pageTotal = list.data?.items.reduce(
    (sum, p) => sum + Math.round(Number(p.amount) * 100),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Payments recorded against invoices. Record new payments from an invoice."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="method" className="block text-xs font-medium text-zinc-600">
            Method
          </label>
          <select
            id="method"
            value={method}
            onChange={(e) => {
              setPage(1);
              setMethod(e.target.value as PaymentMethod | "");
            }}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">All methods</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-zinc-600">
            Paid from
          </label>
          <input
            id="from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPage(1);
              setDateFrom(e.target.value);
            }}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-zinc-600">
            Paid to
          </label>
          <input
            id="to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPage(1);
              setDateTo(e.target.value);
            }}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {list.error && <Alert>{list.error}</Alert>}
      {!list.data ? (
        !list.error && <LoadingRow />
      ) : (
        <>
          <TableShell
            isEmpty={list.data.items.length === 0}
            empty={
              method || dateFrom || dateTo
                ? "No payments match these filters."
                : "No payments recorded yet."
            }
            head={
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            }
          >
            {list.data.items.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-700">{formatDate(p.paid_on)}</td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/staff/invoices/${p.invoice_id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {p.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">{p.customer_email}</td>
                <td className="px-4 py-3 text-zinc-700">{PAYMENT_METHOD_LABEL[p.method]}</td>
                <td className="px-4 py-3 text-zinc-500">{p.reference ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {formatMoney(p.amount)}
                </td>
              </tr>
            ))}
          </TableShell>
          {list.data.items.length > 0 && pageTotal !== undefined && (
            <p className="text-right text-sm text-zinc-600">
              Total on this page:{" "}
              <span className="font-semibold text-zinc-900">{formatMoney(pageTotal / 100)}</span>
            </p>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
