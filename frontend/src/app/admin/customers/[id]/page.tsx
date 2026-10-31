"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ActiveBadge, StatusChangeDialog } from "@/components/admin/account-ui";
import { Panel, PaymentsTable, Stat, Table } from "@/components/admin/detail-ui";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { peopleApi } from "@/lib/admin-api";
import {
  FREQUENCY_LABEL,
  INVOICE_STATUS_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  formatDate,
  formatINR,
} from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customer = useAsyncData(() => peopleApi.getCustomer(id), [id]);
  const [subsPage, setSubsPage] = useState(1);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const subscriptions = useAsyncData(
    () => peopleApi.customerSubscriptions(id, subsPage),
    [id, subsPage],
  );
  const invoices = useAsyncData(
    () => peopleApi.customerInvoices(id, invoicesPage),
    [id, invoicesPage],
  );
  const [toggling, setToggling] = useState(false);

  const c = customer.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight break-all text-zinc-900">
            {c?.email ?? "Customer"}
          </h1>
          {c && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
              <ActiveBadge active={c.is_active} />
              <span>Customer since {formatDate(c.created_at)}</span>
              <span className="font-mono text-xs text-zinc-400">ID {c.id}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {c && (
            <Button variant="secondary" onClick={() => setToggling(true)}>
              {c.is_active ? "Deactivate" : "Activate"}
            </Button>
          )}
          <Link href="/admin/customers" className={buttonClass("secondary")}>
            Back to customers
          </Link>
        </div>
      </div>

      {customer.loading && !c && <LoadingState />}
      {customer.error && <ErrorState message={customer.error} onRetry={customer.reload} />}

      {c && (
        <>
          <section
            aria-label="Customer figures"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Stat label="Active subscriptions" value={String(c.figures.active_subscriptions)}>
              {c.figures.subscriptions_total} in total, including quotations
            </Stat>
            <Stat label="Invoiced" value={formatINR(c.figures.invoiced_amount)}>
              {c.figures.invoices_total} confirmed or paid invoice
              {c.figures.invoices_total === 1 ? "" : "s"}
            </Stat>
            <Stat label="Paid (cash received)" value={formatINR(c.figures.paid_amount)} />
            <Stat label="Outstanding" value={formatINR(c.figures.outstanding_amount)}>
              {c.figures.overdue_invoices > 0 ? (
                <span className="text-red-600">{c.figures.overdue_invoices} overdue</span>
              ) : (
                "Nothing overdue"
              )}
            </Stat>
          </section>

          <Panel title="Subscriptions and quotations">
            {subscriptions.loading && !subscriptions.data && <LoadingState />}
            {subscriptions.error && (
              <ErrorState message={subscriptions.error} onRetry={subscriptions.reload} />
            )}
            {subscriptions.data && subscriptions.data.total === 0 && (
              <EmptyState
                title="No subscriptions yet"
                description="Quotations and subscriptions created by staff appear here."
              />
            )}
            {subscriptions.data && subscriptions.data.total > 0 && (
              <Table
                head={["Number", "Plan", "Billing", "Status", "Start", "Next billing", "Total"]}
              >
                {subscriptions.data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{s.number}</td>
                    <td className="px-4 py-3">{s.plan_name}</td>
                    <td className="px-4 py-3">{FREQUENCY_LABEL[s.billing_frequency]}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          s.status === "ACTIVE"
                            ? "green"
                            : s.status === "CLOSED"
                              ? "zinc"
                              : "indigo"
                        }
                      >
                        {SUBSCRIPTION_STATUS_LABEL[s.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(s.start_date)}</td>
                    <td className="px-4 py-3">{formatDate(s.next_billing_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatINR(s.total)}</td>
                  </tr>
                ))}
              </Table>
            )}
            {subscriptions.data && (
              <PageButtons
                page={subsPage}
                total={subscriptions.data.total}
                onChange={setSubsPage}
              />
            )}
          </Panel>

          <Panel title="Invoices">
            {invoices.loading && !invoices.data && <LoadingState />}
            {invoices.error && <ErrorState message={invoices.error} onRetry={invoices.reload} />}
            {invoices.data && invoices.data.total === 0 && (
              <EmptyState
                title="No invoices yet"
                description="Invoices are generated from active subscriptions on their billing dates."
              />
            )}
            {invoices.data && invoices.data.total > 0 && (
              <Table head={["Number", "Period", "Due", "Status", "Total", "Paid", "Due amount"]}>
                {invoices.data.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{i.number}</td>
                    <td className="px-4 py-3">
                      {formatDate(i.period_start)} – {formatDate(i.period_end)}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(i.due_date)}
                      {i.is_overdue && (
                        <span className="ml-2">
                          <Badge tone="red">Overdue</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          i.status === "PAID"
                            ? "green"
                            : i.status === "CANCELLED"
                              ? "zinc"
                              : "amber"
                        }
                      >
                        {INVOICE_STATUS_LABEL[i.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatINR(i.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatINR(i.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatINR(i.amount_due)}</td>
                  </tr>
                ))}
              </Table>
            )}
            {invoices.data && (
              <PageButtons
                page={invoicesPage}
                total={invoices.data.total}
                onChange={setInvoicesPage}
              />
            )}
          </Panel>

          <Panel title="Recent payments">
            <PaymentsTable payments={c.recent_payments} />
          </Panel>
        </>
      )}

      <StatusChangeDialog
        account={toggling && c ? c : null}
        onClose={() => setToggling(false)}
        onChanged={customer.reload}
      />
    </div>
  );
}

/** The staff API pages by page number, so this pages by number too. */
function PageButtons({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between text-sm text-zinc-600">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
