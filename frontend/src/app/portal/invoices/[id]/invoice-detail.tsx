"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { Alert, Button, InvoiceStatusBadge, LoadingRow } from "@/components/staff/ui";
import { formatDate, formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { getMyInvoice } from "@/lib/portal-api";
import type { Invoice } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function MyInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const loaded = useApiData(() => getMyInvoice(id), [id]);
  const invoice = loaded.data;

  if (loaded.error && !invoice) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert>{loaded.error}</Alert>
      </div>
    );
  }
  if (!invoice) return <LoadingRow />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink />
        <Button variant="secondary" onClick={() => window.print()}>
          Print / save PDF
        </Button>
      </div>

      {invoice.is_overdue && (
        <div className="print:hidden">
          <Alert>
            This invoice was due on {formatDate(invoice.due_date)}.{" "}
            {formatMoney(invoice.amount_due)} is still outstanding.
          </Alert>
        </div>
      )}

      <InvoiceDocument invoice={invoice} />

      <section className="print:hidden">
        <h2 className="mb-3 text-base font-semibold text-zinc-900">Payments received</h2>
        {invoice.payments.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            No payments received yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {invoice.payments.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <p className="text-sm font-medium text-zinc-900">
                  {formatMoney(p.amount)} · {PAYMENT_METHOD_LABEL[p.method]}
                  {p.reference && <span className="text-zinc-500"> · Ref {p.reference}</span>}
                </p>
                <p className="text-xs text-zinc-500">Received {formatDate(p.paid_on)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/portal/invoices" className="text-sm text-indigo-600 hover:text-indigo-500">
      ← My invoices
    </Link>
  );
}

function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-200 pb-6">
        <div>
          <BrandLogo />
          <p className="mt-3 text-sm text-zinc-500">Brightloop Software</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Invoice</p>
          <p className="text-2xl font-semibold text-zinc-900">{invoice.number}</p>
          <div className="mt-2">
            <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 py-6 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Bill to</p>
          <p className="mt-1 text-zinc-900">{invoice.customer.email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Subscription
          </p>
          <p className="mt-1 text-zinc-900">
            {invoice.subscription.number} · {invoice.subscription.plan_name}
          </p>
          <p className="text-zinc-600">
            {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-zinc-600">
            Invoice date: <span className="text-zinc-900">{formatDate(invoice.invoice_date)}</span>
          </p>
          <p className="text-zinc-600">
            Due date: <span className="text-zinc-900">{formatDate(invoice.due_date)}</span>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-y border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">Unit price</th>
              <th className="py-2 pr-4 text-right">Tax</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {invoice.lines.map((line, index) => (
              <tr key={index}>
                <td className="py-2.5 pr-4 text-zinc-900">{line.description}</td>
                <td className="py-2.5 pr-4 text-right text-zinc-700">{line.quantity}</td>
                <td className="py-2.5 pr-4 text-right text-zinc-700">
                  {formatMoney(line.unit_price)}
                </td>
                <td className="py-2.5 pr-4 text-right text-zinc-700">
                  {formatMoney(line.tax_amount)}{" "}
                  <span className="text-xs text-zinc-500">({Number(line.tax_rate)}%)</span>
                </td>
                <td className="py-2.5 text-right font-medium text-zinc-900">
                  {formatMoney(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-6 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between text-zinc-600">
          <dt>Subtotal</dt>
          <dd>{formatMoney(invoice.subtotal)}</dd>
        </div>
        {Number(invoice.discount_total) > 0 && (
          <div className="flex justify-between text-emerald-700">
            <dt>Discount{invoice.discount_name ? ` (${invoice.discount_name})` : ""}</dt>
            <dd>−{formatMoney(invoice.discount_total)}</dd>
          </div>
        )}
        <div className="flex justify-between text-zinc-600">
          <dt>Tax</dt>
          <dd>{formatMoney(invoice.tax_total)}</dd>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-semibold text-zinc-900">
          <dt>Total</dt>
          <dd>{formatMoney(invoice.total)}</dd>
        </div>
        <div className="flex justify-between text-zinc-600">
          <dt>Paid</dt>
          <dd>{formatMoney(invoice.amount_paid)}</dd>
        </div>
        {invoice.status !== "CANCELLED" && (
          <div className="flex justify-between font-semibold text-zinc-900">
            <dt>Balance due</dt>
            <dd>{formatMoney(invoice.amount_due)}</dd>
          </div>
        )}
      </dl>

      {invoice.status === "CONFIRMED" && Number(invoice.amount_due) > 0 && (
        <p className="mt-8 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
          Please pay by {formatDate(invoice.due_date)} and quote {invoice.number} as the payment
          reference.
        </p>
      )}
    </article>
  );
}
