"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/feedback";
import type { PaymentBrief } from "@/lib/admin-api";
import { PAYMENT_METHOD_LABEL, formatDate, formatINR } from "@/lib/format";
import type { PaymentMethod } from "@/lib/staff-api";

/** Building blocks shared by the admin customer and staff detail pages. */

export function PaymentsTable({ payments }: { payments: PaymentBrief[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState title="No payments yet" description="Payments recorded by staff appear here." />
    );
  }
  return (
    <Table head={["Date", "Invoice", "Customer", "Method", "Amount"]}>
      {payments.map((p) => (
        <tr key={p.id}>
          <td className="px-4 py-3">{formatDate(p.paid_on)}</td>
          <td className="px-4 py-3 font-medium">
            <Link
              href={`/staff/invoices/${p.invoice_id}`}
              className="text-indigo-600 hover:underline"
            >
              {p.invoice_number}
            </Link>
          </td>
          <td className="px-4 py-3">{p.customer_email}</td>
          <td className="px-4 py-3">
            {PAYMENT_METHOD_LABEL[p.method as PaymentMethod] ?? p.method}
          </td>
          <td className="px-4 py-3 text-right tabular-nums">{formatINR(p.amount)}</td>
        </tr>
      ))}
    </Table>
  );
}

export function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      {children && <p className="mt-1 text-xs text-zinc-500">{children}</p>}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-sm text-zinc-700">
        <thead className="text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}
