import { BrandLogo } from "@/components/brand-logo";
import { BillTo } from "@/components/staff/ui";
import { formatDate, formatMoney, FREQUENCY_LABEL } from "@/lib/format";
import type { BillingFrequency, Subscription } from "@/lib/staff-api";

const CYCLE_LABEL: Record<BillingFrequency, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

/**
 * The printable quotation. It's hidden on screen and is the only thing on the page when
 * printing, so "Print / save PDF" produces a clean document.
 */
export function QuotationDocument({ sub }: { sub: Subscription }) {
  const isOffer = sub.status === "DRAFT" || sub.status === "QUOTATION";
  return (
    <article className="hidden text-zinc-900 print:block">
      <header className="flex items-start justify-between gap-6 border-b border-zinc-300 pb-6">
        <div>
          <BrandLogo />
          <p className="mt-3 text-sm text-zinc-600">Brightloop Software</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {isOffer ? "Quotation" : "Subscription"}
          </p>
          <p className="text-2xl font-semibold">{sub.number}</p>
          {sub.status === "DRAFT" && <p className="mt-1 text-sm text-amber-700">Draft</p>}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6 py-6 text-sm">
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Prepared for
          </p>
          <div className="mt-1">
            <BillTo customer={sub.customer} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Plan</p>
          <p className="mt-1">{sub.plan_name}</p>
          <p className="text-zinc-600">
            Billed {FREQUENCY_LABEL[sub.billing_frequency].toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-zinc-600">
            Date: <span className="text-zinc-900">{formatDate(sub.created_at)}</span>
          </p>
          {sub.quotation_valid_until && (
            <p className="text-zinc-600">
              Valid until:{" "}
              <span className="text-zinc-900">{formatDate(sub.quotation_valid_until)}</span>
            </p>
          )}
          <p className="text-zinc-600">
            Payment terms: <span className="text-zinc-900">{sub.payment_terms_days} days</span>
          </p>
          {sub.start_date && (
            <p className="text-zinc-600">
              Start: <span className="text-zinc-900">{formatDate(sub.start_date)}</span>
            </p>
          )}
          {sub.expiry_date && (
            <p className="text-zinc-600">
              Expiry: <span className="text-zinc-900">{formatDate(sub.expiry_date)}</span>
            </p>
          )}
        </div>
      </div>

      <table className="min-w-full text-sm">
        <thead className="border-y border-zinc-300 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <tr>
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4 text-right">Qty</th>
            <th className="py-2 pr-4 text-right">Unit price</th>
            <th className="py-2 pr-4 text-right">Tax</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sub.lines.map((line) => (
            <tr key={line.id}>
              <td className="py-2.5 pr-4">{line.description}</td>
              <td className="py-2.5 pr-4 text-right">{line.quantity}</td>
              <td className="py-2.5 pr-4 text-right">{formatMoney(line.unit_price)}</td>
              <td className="py-2.5 pr-4 text-right">
                {formatMoney(line.tax_amount)}{" "}
                <span className="text-xs text-zinc-500">({Number(line.tax_rate)}%)</span>
              </td>
              <td className="py-2.5 text-right font-medium">{formatMoney(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between text-zinc-600">
          <dt>Subtotal</dt>
          <dd>{formatMoney(sub.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-zinc-600">
          <dt>Tax</dt>
          <dd>{formatMoney(sub.tax_total)}</dd>
        </div>
        <div className="flex justify-between border-t border-zinc-300 pt-1.5 font-semibold">
          <dt>Total per {CYCLE_LABEL[sub.billing_frequency]}</dt>
          <dd>{formatMoney(sub.total)}</dd>
        </div>
      </dl>

      {sub.notes && (
        <section className="mt-8 text-sm">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Notes</p>
          <p className="mt-1 whitespace-pre-line text-zinc-700">{sub.notes}</p>
        </section>
      )}

      {isOffer && (
        <p className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          This quotation can be accepted from your Brightloop customer portal
          {sub.quotation_valid_until ? ` until ${formatDate(sub.quotation_valid_until)}` : ""}.
          Prices are in Indian rupees.
        </p>
      )}
    </article>
  );
}
