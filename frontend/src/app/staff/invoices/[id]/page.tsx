"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CompanyDetails } from "@/components/company-details";
import {
  Alert,
  BillTo,
  Button,
  Card,
  Field,
  inputClass,
  InvoiceStatusBadge,
  LoadingRow,
} from "@/components/staff/ui";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  PAYMENT_METHOD_LABEL,
  todayIso,
} from "@/lib/format";
import {
  errorMessage,
  getInvoice,
  recordPayment,
  runInvoiceAction,
  type Invoice,
  type PaymentMethod,
} from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

const METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const loaded = useApiData(() => getInvoice(id), [id]);
  const [override, setOverride] = useState<Invoice | null>(null);
  const invoice = override && override.id === id ? override : loaded.data;

  if (loaded.error && !invoice) return <Alert>{loaded.error}</Alert>;
  if (!invoice) return <LoadingRow />;

  return (
    <div className="space-y-6">
      <Link
        href="/staff/invoices"
        className="text-sm text-indigo-600 hover:text-indigo-500 print:hidden"
      >
        ← Invoices
      </Link>

      <InvoiceActions invoice={invoice} onUpdated={setOverride} />

      <InvoiceDocument invoice={invoice} />

      {invoice.status === "CONFIRMED" && (
        <PaymentForm
          // Reset the form (amount defaults to the new balance) after each payment.
          key={invoice.amount_paid}
          invoice={invoice}
          onRecorded={() => getInvoice(id).then(setOverride)}
        />
      )}

      <section className="print:hidden">
        <h2 className="mb-3 text-base font-semibold text-zinc-900">Payments</h2>
        {invoice.payments.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            No payments recorded.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {invoice.payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {formatMoney(p.amount)} · {PAYMENT_METHOD_LABEL[p.method]}
                    {p.reference && <span className="text-zinc-500"> · Txn {p.reference}</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Paid {formatDate(p.paid_on)}
                    {p.recorded_by && ` · recorded by ${p.recorded_by}`}
                  </p>
                  {p.notes && <p className="mt-1 text-sm text-zinc-600">{p.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InvoiceActions({
  invoice,
  onUpdated,
}: {
  invoice: Invoice;
  onUpdated: (invoice: Invoice) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function run(action: "confirm" | "cancel" | "send") {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      onUpdated(await runInvoiceAction(invoice.id, action));
      setConfirmCancel(false);
      if (action === "send") {
        setNotice(
          "Marked as sent. Email delivery isn't set up yet, so print or save it as PDF and share it with the customer.",
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const canCancel =
    (invoice.status === "DRAFT" || invoice.status === "CONFIRMED") &&
    Number(invoice.amount_paid) === 0;

  return (
    <div className="space-y-3 print:hidden">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {invoice.status === "DRAFT" && (
          <Button busy={busy === "confirm"} onClick={() => run("confirm")}>
            Confirm invoice
          </Button>
        )}
        {(invoice.status === "CONFIRMED" || invoice.status === "PAID") && (
          <Button busy={busy === "send"} onClick={() => run("send")}>
            {invoice.sent_at ? "Mark as sent again" : "Mark as sent"}
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.print()}>
          Print / save PDF
        </Button>
        {canCancel &&
          (confirmCancel ? (
            <>
              <span className="text-sm text-zinc-700">
                Cancel {invoice.number}? Its period won&apos;t be billed again automatically.
              </span>
              <Button variant="danger" busy={busy === "cancel"} onClick={() => run("cancel")}>
                Yes, cancel
              </Button>
              <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>
              Cancel invoice
            </Button>
          ))}
        {invoice.sent_at && (
          <span className="text-xs text-zinc-500">Sent {formatDateTime(invoice.sent_at)}</span>
        )}
      </div>
    </div>
  );
}

function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-200 pb-6">
        <div>
          <BrandLogo />
          <CompanyDetails />
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
          <div className="mt-1">
            <BillTo customer={invoice.customer} />
          </div>
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
    </article>
  );
}

function PaymentForm({ invoice, onRecorded }: { invoice: Invoice; onRecorded: () => void }) {
  const [amount, setAmount] = useState(invoice.amount_due);
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const next: Record<string, string> = {};
    const due = Math.round(Number(invoice.amount_due) * 100);
    const paise = Math.round(Number(amount) * 100);
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || paise <= 0)
      next.amount = "Enter an amount such as 1500 or 1500.50.";
    else if (paise > due)
      next.amount = `No more than the balance of ${formatMoney(invoice.amount_due)}.`;
    if (!paidOn) next.paidOn = "Choose the payment date.";
    else if (paidOn > todayIso()) next.paidOn = "The payment date can't be in the future.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await recordPayment({
        invoice_id: invoice.id,
        amount,
        method,
        paid_on: paidOn,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      onRecorded();
    } catch (err) {
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="print:hidden">
      <Card title="Record a payment">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Amount (₹)" htmlFor="amount" error={errors.amount}>
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={Boolean(errors.amount)}
                className={inputClass}
              />
            </Field>
            <Field label="Method" htmlFor="method">
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className={inputClass}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment date" htmlFor="paid-on" error={errors.paidOn}>
              <input
                id="paid-on"
                type="date"
                max={todayIso()}
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                aria-invalid={Boolean(errors.paidOn)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Transaction ID (optional)"
              htmlFor="reference"
              hint="UTR, UPI ref, cheque no., etc."
            >
              <input
                id="reference"
                maxLength={100}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes (optional)" htmlFor="payment-notes">
                <input
                  id="payment-notes"
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" busy={submitting}>
              {submitting ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
