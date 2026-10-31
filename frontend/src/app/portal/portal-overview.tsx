"use client";

import Link from "next/link";

import { usePortalUser } from "@/components/portal/portal-shell";
import {
  Alert,
  ButtonLink,
  Card,
  InvoiceStatusBadge,
  LoadingRow,
  PageHeader,
  SubscriptionStatusBadge,
} from "@/components/staff/ui";
import { formatDate, formatMoney, FREQUENCY_LABEL, todayIso } from "@/lib/format";
import {
  isQuotationExpired,
  listMyInvoices,
  listMySubscriptions,
  PORTAL_MAX_PAGE_SIZE,
} from "@/lib/portal-api";
import { useApiData } from "@/lib/use-api-data";

export default function PortalOverviewPage() {
  const { email } = usePortalUser();
  // A customer has few records, so one page of each is enough for the summary.
  const data = useApiData(
    () =>
      Promise.all([
        listMySubscriptions(1, PORTAL_MAX_PAGE_SIZE),
        listMyInvoices(1, PORTAL_MAX_PAGE_SIZE),
      ]),
    [],
  );

  if (data.error && !data.data) return <Alert>{data.error}</Alert>;
  if (!data.data) return <LoadingRow />;

  const [subs, invoices] = data.data;
  const today = todayIso();
  const pendingQuotations = subs.items.filter(
    (s) => s.status === "QUOTATION" && !isQuotationExpired(s, today),
  );
  const activeCount = subs.items.filter((s) => s.status === "ACTIVE").length;
  const unpaid = invoices.items.filter((i) => i.status === "CONFIRMED");
  const overdue = unpaid.filter((i) => i.is_overdue);
  const balanceDue = unpaid.reduce((sum, i) => sum + Number(i.amount_due), 0);
  const overdueAmount = overdue.reduce((sum, i) => sum + Number(i.amount_due), 0);
  const partial = subs.total > subs.items.length || invoices.total > invoices.items.length;

  // New accounts (e.g. just signed up) have nothing yet: explain what happens next.
  if (subs.total === 0 && invoices.total === 0) {
    return <WelcomeState email={email} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your subscriptions, quotations and invoices with Brightloop Software."
      />

      {pendingQuotations.length > 0 && (
        <Alert tone="info">
          You have {pendingQuotations.length === 1 ? "a quotation" : "quotations"} waiting for your
          review.{" "}
          <Link
            href={`/portal/subscriptions/${pendingQuotations[0].id}`}
            className="font-semibold underline"
          >
            Review {pendingQuotations[0].number}
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active subscriptions" value={String(activeCount)} />
        <Stat label="Quotations to review" value={String(pendingQuotations.length)} />
        <Stat label="Balance due" value={formatMoney(balanceDue)} />
        <Stat
          label="Overdue"
          value={formatMoney(overdueAmount)}
          hint={`${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`}
          tone={overdue.length > 0 ? "danger" : "default"}
        />
      </div>
      {partial && (
        <p className="text-xs text-zinc-500">
          Totals are based on your {PORTAL_MAX_PAGE_SIZE} most recent records.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Recent subscriptions"
          actions={
            <Link
              href="/portal/subscriptions"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          }
        >
          {subs.items.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No subscriptions yet. Quotations from Brightloop will appear here.
            </p>
          ) : (
            <ul className="-my-2 divide-y divide-zinc-100">
              {subs.items.slice(0, 5).map((sub) => (
                <li key={sub.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/portal/subscriptions/${sub.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {sub.number}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">
                      {sub.plan_name} · {FREQUENCY_LABEL[sub.billing_frequency]} ·{" "}
                      {formatMoney(sub.total)}
                    </p>
                  </div>
                  <SubscriptionStatusBadge status={sub.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent invoices"
          actions={
            <Link href="/portal/invoices" className="text-sm text-indigo-600 hover:text-indigo-500">
              View all
            </Link>
          }
        >
          {invoices.items.length === 0 ? (
            <p className="text-sm text-zinc-500">No invoices yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-zinc-100">
              {invoices.items.slice(0, 5).map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/portal/invoices/${invoice.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {invoice.number}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">
                      Due {formatDate(invoice.due_date)} · {formatMoney(invoice.total)}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={invoice.status} overdue={invoice.is_overdue} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {unpaid.length > 0 && (
        <div className="flex justify-end">
          <ButtonLink href="/portal/invoices" variant="secondary">
            See unpaid invoices
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

const STEPS = [
  {
    title: "Brightloop sends you a quotation",
    body: "Our team prepares an offer with your plan, quantities, prices and taxes.",
  },
  {
    title: "You review and accept it",
    body: "The quotation appears under My subscriptions. Accept it before it expires.",
  },
  {
    title: "Your subscription starts",
    body: "Once activated, invoices are created each billing period and listed under My invoices.",
  },
];

function WelcomeState({ email }: { email: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome to Brightloop"
        description="Your account is ready. Here's how getting started works."
      />
      <Card>
        <ol className="space-y-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-zinc-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Alert tone="info">
        To request a quotation, contact Brightloop and mention your account email:{" "}
        <span className="font-semibold">{email}</span>
      </Alert>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${tone === "danger" ? "text-red-700" : "text-zinc-900"}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
