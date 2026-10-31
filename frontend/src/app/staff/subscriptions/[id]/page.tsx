"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { QuotationDocument } from "@/components/staff/quotation-document";
import { SubscriptionForm } from "@/components/staff/subscription-form";
import {
  Alert,
  CustomerCell,
  Button,
  Card,
  DetailList,
  inputClass,
  InvoiceStatusBadge,
  LoadingRow,
  PageHeader,
  SubscriptionStatusBadge,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatDateTime, formatMoney, FREQUENCY_LABEL, todayIso } from "@/lib/format";
import {
  customerName,
  errorMessage,
  getSubscription,
  listInvoices,
  runSubscriptionAction,
  updateSubscription,
  type Subscription,
  type SubscriptionAction,
} from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const subscription = useApiData(() => getSubscription(id), [id]);
  const invoices = useApiData(() => listInvoices({ subscription_id: id }), [id]);
  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState<Subscription | null>(null);

  // Show the latest server response after an action without waiting for a refetch.
  const sub = override && override.id === id ? override : subscription.data;

  if (subscription.error && !sub) return <Alert>{subscription.error}</Alert>;
  if (!sub) return <LoadingRow />;

  function applyUpdate(updated: Subscription) {
    setOverride(updated);
    invoices.reload();
  }

  return (
    <>
      <QuotationDocument sub={sub} />
      <div className="space-y-6 print:hidden">
        <Link href="/staff/subscriptions" className="text-sm text-indigo-600 hover:text-indigo-500">
          ← Quotations & subscriptions
        </Link>
        <PageHeader
          title={sub.number}
          description={`${sub.plan_name} · ${customerName(sub.customer)}`}
          actions={
            <>
              <SubscriptionStatusBadge status={sub.status} />
              {!editing && sub.lines.length > 0 && (
                <Button variant="secondary" onClick={() => window.print()}>
                  {sub.status === "DRAFT" || sub.status === "QUOTATION"
                    ? "Download quotation (PDF)"
                    : "Print / save PDF"}
                </Button>
              )}
            </>
          }
        />

        {editing ? (
          <SubscriptionForm
            initial={sub}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              applyUpdate(await updateSubscription(sub.id, input));
              setEditing(false);
            }}
          />
        ) : (
          <>
            <LifecycleActions sub={sub} onUpdated={applyUpdate} onEdit={() => setEditing(true)} />

            <Card title="Details">
              <DetailList
                items={[
                  [
                    "Customer",
                    <CustomerCell
                      key="customer"
                      customer={sub.customer}
                      href={`/staff/customers/${sub.customer.id}`}
                    />,
                  ],
                  ["Billing", FREQUENCY_LABEL[sub.billing_frequency]],
                  ["Payment terms", `${sub.payment_terms_days} days`],
                  ["Quotation valid until", formatDate(sub.quotation_valid_until)],
                  ["Start date", formatDate(sub.start_date)],
                  ["Expiry date", formatDate(sub.expiry_date)],
                  ["Next billing date", formatDate(sub.next_billing_date)],
                  ["Created", formatDateTime(sub.created_at)],
                  ["Quotation sent", formatDateTime(sub.quotation_sent_at)],
                  ["Confirmed", formatDateTime(sub.confirmed_at)],
                  ["Activated", formatDateTime(sub.activated_at)],
                  ["Closed", formatDateTime(sub.closed_at)],
                ]}
              />
              {sub.notes && (
                <p className="mt-5 rounded-lg bg-zinc-50 p-3 text-sm whitespace-pre-line text-zinc-700">
                  {sub.notes}
                </p>
              )}
            </Card>

            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-900">Lines</h2>
              <TableShell
                isEmpty={sub.lines.length === 0}
                empty="No lines yet. Edit the draft to add them."
                head={
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                }
              >
                {sub.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 text-zinc-900">{line.description}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">{line.quantity}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {formatMoney(line.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">
                      {formatMoney(line.tax_amount)}
                      <span className="block text-xs text-zinc-500">{Number(line.tax_rate)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {formatMoney(line.total)}
                    </td>
                  </tr>
                ))}
              </TableShell>
              <dl className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(sub.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <dt>Tax</dt>
                  <dd>{formatMoney(sub.tax_total)}</dd>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-1 font-semibold text-zinc-900">
                  <dt>Total per cycle</dt>
                  <dd>{formatMoney(sub.total)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-900">Invoices</h2>
              {invoices.error && <Alert>{invoices.error}</Alert>}
              {invoices.data && (
                <TableShell
                  isEmpty={invoices.data.items.length === 0}
                  empty="No invoices yet. They are generated from the start date once active."
                  head={
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  }
                >
                  {invoices.data.items.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/staff/invoices/${invoice.id}`}
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          {invoice.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-3 text-right text-zinc-900">
                        {formatMoney(invoice.total)}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
                      </td>
                    </tr>
                  ))}
                </TableShell>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function LifecycleActions({
  sub,
  onUpdated,
  onEdit,
}: {
  sub: Subscription;
  onUpdated: (sub: Subscription) => void;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validDays, setValidDays] = useState("15");
  const [startDate, setStartDate] = useState(todayIso());
  const [confirmClose, setConfirmClose] = useState(false);

  async function run(request: SubscriptionAction) {
    setBusy(request.action);
    setError(null);
    try {
      onUpdated(await runSubscriptionAction(sub.id, request));
      setConfirmClose(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const days = Number(validDays);
  const daysValid = Number.isInteger(days) && days >= 1 && days <= 365;

  if (sub.status === "CLOSED" && sub.rejected_at) {
    return (
      <Alert>
        <span className="font-semibold">Declined by the customer</span> on{" "}
        {formatDateTime(sub.rejected_at)}.
        <span className="mt-1 block">
          {sub.rejection_reason ? `Reason: “${sub.rejection_reason}”` : "No reason given."}
        </span>
        <span className="mt-1 block">Create a new quotation to send a revised offer.</span>
      </Alert>
    );
  }

  if (sub.status === "CLOSED") {
    return (
      <Alert tone="info">This subscription is closed. No further invoices will be generated.</Alert>
    );
  }

  return (
    <Card title="Next step">
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {sub.status === "DRAFT" && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="valid-days" className="block text-xs font-medium text-zinc-600">
              Quotation valid for (days)
            </label>
            <input
              id="valid-days"
              type="number"
              min={1}
              max={365}
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              aria-invalid={!daysValid}
              className={`mt-1 w-32 ${inputClass}`}
            />
          </div>
          <Button
            busy={busy === "send-quotation"}
            disabled={!daysValid || sub.lines.length === 0}
            onClick={() => run({ action: "send-quotation", body: { valid_days: days } })}
          >
            Send quotation
          </Button>
          <Button variant="secondary" onClick={onEdit}>
            Edit draft
          </Button>
          {sub.lines.length === 0 && (
            <p className="w-full text-sm text-zinc-500">Add at least one line before sending.</p>
          )}
        </div>
      )}

      {sub.status === "QUOTATION" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">
            Waiting for the customer to accept in their portal, valid until{" "}
            <span className="font-medium text-zinc-900">
              {formatDate(sub.quotation_valid_until)}
            </span>
            . If they accepted another way, confirm it here.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button busy={busy === "confirm"} onClick={() => run({ action: "confirm" })}>
              Mark as accepted
            </Button>
            <Button
              variant="secondary"
              busy={busy === "revert-to-draft"}
              onClick={() => run({ action: "revert-to-draft" })}
            >
              Back to draft to edit
            </Button>
          </div>
        </div>
      )}

      {sub.status === "CONFIRMED" && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="start-date" className="block text-xs font-medium text-zinc-600">
              Start date (first billing date)
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <Button
            busy={busy === "activate"}
            disabled={!startDate}
            onClick={() =>
              run({ action: "activate", body: { start_date: startDate, expiry_date: null } })
            }
          >
            Activate subscription
          </Button>
        </div>
      )}

      {sub.status === "ACTIVE" && (
        <p className="text-sm text-zinc-600">
          Active. The next invoice is generated on{" "}
          <span className="font-medium text-zinc-900">{formatDate(sub.next_billing_date)}</span>
          {sub.next_billing_date === null && " (billing has ended at the expiry date)"}.
        </p>
      )}

      <div className="mt-5 border-t border-zinc-100 pt-4">
        {confirmClose ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-700">
              Close {sub.number}? This stops all future billing and can&apos;t be undone.
            </p>
            <Button
              variant="danger"
              busy={busy === "close"}
              onClick={() => run({ action: "close" })}
            >
              Yes, close it
            </Button>
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmClose(true)}>
            {sub.status === "ACTIVE" ? "Close subscription" : "Close without activating"}
          </Button>
        )}
      </div>
    </Card>
  );
}
