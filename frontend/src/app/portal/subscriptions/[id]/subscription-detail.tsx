"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  DetailList,
  LoadingRow,
  PageHeader,
  SubscriptionStatusBadge,
} from "@/components/staff/ui";
import { formatDate, formatDateTime, formatMoney, FREQUENCY_LABEL, todayIso } from "@/lib/format";
import { acceptQuotation, getMySubscription, isQuotationExpired } from "@/lib/portal-api";
import { errorMessage, type Subscription } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

const STATUS_HELP: Record<Subscription["status"], string> = {
  DRAFT: "",
  QUOTATION: "Review the offer below. Accepting it confirms your order.",
  CONFIRMED: "You accepted this quotation. Brightloop will activate it and start billing.",
  ACTIVE: "This subscription is running. Invoices are generated each billing period.",
  CLOSED: "This subscription has ended. No further invoices will be generated.",
};

export default function MySubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const loaded = useApiData(() => getMySubscription(id), [id]);
  const [override, setOverride] = useState<Subscription | null>(null);
  const sub = override && override.id === id ? override : loaded.data;

  if (loaded.error && !sub) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert>{loaded.error}</Alert>
      </div>
    );
  }
  if (!sub) return <LoadingRow />;

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={sub.number}
        description={STATUS_HELP[sub.status]}
        actions={<SubscriptionStatusBadge status={sub.status} />}
      />

      {sub.status === "QUOTATION" && <AcceptPanel sub={sub} onAccepted={setOverride} />}

      <Card title="Details">
        <DetailList
          items={[
            ["Plan", sub.plan_name],
            ["Billing", FREQUENCY_LABEL[sub.billing_frequency]],
            [
              "Payment terms",
              sub.payment_terms_days === 0
                ? "Due on invoice date"
                : `${sub.payment_terms_days} days after invoice date`,
            ],
            ...(sub.status === "QUOTATION"
              ? ([["Quotation valid until", formatDate(sub.quotation_valid_until)]] as [
                  string,
                  string,
                ][])
              : []),
            ["Start date", sub.start_date ? formatDate(sub.start_date) : "When activated"],
            ["Expiry date", sub.expiry_date ? formatDate(sub.expiry_date) : "No end date"],
            ...(sub.status === "ACTIVE"
              ? ([["Next billing date", formatDate(sub.next_billing_date)]] as [string, string][])
              : []),
            ...(sub.confirmed_at
              ? ([["Accepted on", formatDateTime(sub.confirmed_at)]] as [string, string][])
              : []),
            ...(sub.closed_at
              ? ([["Closed on", formatDateTime(sub.closed_at)]] as [string, string][])
              : []),
          ]}
        />
        {sub.notes && (
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Notes</p>
            <p className="mt-1 text-sm whitespace-pre-line text-zinc-700">{sub.notes}</p>
          </div>
        )}
      </Card>

      <Card title="Order lines">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-5 py-2.5">Description</th>
                <th className="px-5 py-2.5 text-right">Qty</th>
                <th className="px-5 py-2.5 text-right">Unit price</th>
                <th className="px-5 py-2.5 text-right">Tax</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sub.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-5 py-2.5 text-zinc-900">{line.description}</td>
                  <td className="px-5 py-2.5 text-right text-zinc-700">{line.quantity}</td>
                  <td className="px-5 py-2.5 text-right text-zinc-700">
                    {formatMoney(line.unit_price)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-zinc-700">
                    {formatMoney(line.tax_amount)}{" "}
                    <span className="text-xs text-zinc-500">({Number(line.tax_rate)}%)</span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium text-zinc-900">
                    {formatMoney(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-200 text-sm">
              <tr>
                <td colSpan={4} className="px-5 pt-3 text-right text-zinc-600">
                  Subtotal
                </td>
                <td className="px-5 pt-3 text-right text-zinc-900">{formatMoney(sub.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 py-1 text-right text-zinc-600">
                  Tax
                </td>
                <td className="px-5 py-1 text-right text-zinc-900">{formatMoney(sub.tax_total)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 pb-3 text-right font-semibold text-zinc-900">
                  Total per {FREQUENCY_LABEL[sub.billing_frequency].toLowerCase()} period
                </td>
                <td className="px-5 pb-3 text-right font-semibold text-zinc-900">
                  {formatMoney(sub.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {(sub.status === "ACTIVE" || sub.status === "CLOSED") && (
        <p className="text-sm text-zinc-600">
          Invoices for this subscription are listed under{" "}
          <Link href="/portal/invoices" className="text-indigo-600 hover:text-indigo-500">
            My invoices
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/portal/subscriptions" className="text-sm text-indigo-600 hover:text-indigo-500">
      ← My subscriptions
    </Link>
  );
}

function AcceptPanel({
  sub,
  onAccepted,
}: {
  sub: Subscription;
  onAccepted: (sub: Subscription) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  if (isQuotationExpired(sub, todayIso())) {
    return (
      <Alert>
        This quotation expired on {formatDate(sub.quotation_valid_until)}. Contact Brightloop for an
        updated offer.
      </Alert>
    );
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const updated = await acceptQuotation(sub.id);
      setAccepted(true);
      onAccepted(updated);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (accepted) {
    return <Alert tone="success">Quotation accepted. Thank you!</Alert>;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {formatMoney(sub.total)} per {FREQUENCY_LABEL[sub.billing_frequency].toLowerCase()}{" "}
            period
          </p>
          <p className="text-sm text-zinc-600">
            Valid until {formatDate(sub.quotation_valid_until)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-zinc-700">Accept {sub.number}?</span>
              <Button busy={busy} onClick={accept}>
                Yes, accept
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </>
          ) : (
            <Button onClick={() => setConfirming(true)}>Accept quotation</Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
}
