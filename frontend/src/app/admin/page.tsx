"use client";

import Link from "next/link";

import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { adminApi, peopleApi } from "@/lib/admin-api";
import { formatINR } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

type Counts = {
  products: number;
  archivedProducts: number;
  plans: number;
  offerablePlans: number;
};

async function loadCounts(): Promise<Counts> {
  // limit=1 keeps each request small: only the total is used.
  const [products, archived, plans, offerable] = await Promise.all([
    adminApi.listProducts({ limit: 1 }),
    adminApi.listProducts({ status: "ARCHIVED", limit: 1 }),
    adminApi.listPlans({ limit: 1 }),
    adminApi.listPlans({ offerable: true, limit: 1 }),
  ]);
  return {
    products: products.total,
    archivedProducts: archived.total,
    plans: plans.total,
    offerablePlans: offerable.total,
  };
}

const ADMIN_MODULES = [
  { label: "Taxes", href: "/admin/taxes", note: "Tax rates and which products they apply to" },
  { label: "Discounts", href: "/admin/discounts", note: "Fixed or % discounts with limits" },
  { label: "Reports", href: "/admin/reports", note: "Revenue and subscriptions by date range" },
  { label: "Settings", href: "/admin/settings", note: "Company details and invoice prefix" },
];

export default function AdminDashboardPage() {
  const counts = useAsyncData(loadCounts, []);
  const business = useAsyncData(peopleApi.businessOverview, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Business and catalog overview. Every figure comes straight from the database.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/products/new" className={buttonClass("secondary")}>
            New product
          </Link>
          <Link href="/admin/plans/new" className={buttonClass("primary")}>
            New plan
          </Link>
        </div>
      </div>

      {business.loading && !business.data && <LoadingState />}
      {business.error && <ErrorState message={business.error} onRetry={business.reload} />}
      {business.data && (
        <section aria-label="Business summary" className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Customers and billing</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Customers"
              value={business.data.total_customers}
              href="/admin/customers"
              note={`${business.data.active_customers} active`}
            />
            <KpiCard
              label="Active subscriptions"
              value={business.data.active_subscriptions}
              href="/staff/subscriptions"
              note={`${business.data.open_quotations} open quotation${business.data.open_quotations === 1 ? "" : "s"}`}
            />
            <KpiCard
              label="Cash received"
              value={formatINR(business.data.revenue_received)}
              href="/staff/payments"
              note={`${business.data.payments_count} payment${business.data.payments_count === 1 ? "" : "s"} recorded`}
            />
            <KpiCard
              label="Outstanding"
              value={formatINR(business.data.outstanding_amount)}
              href="/staff/invoices"
              note={
                business.data.overdue_invoices > 0
                  ? `${business.data.overdue_invoices} overdue: ${formatINR(business.data.overdue_amount)}`
                  : `${business.data.outstanding_invoices} unpaid invoice${business.data.outstanding_invoices === 1 ? "" : "s"}, none overdue`
              }
              alert={business.data.overdue_invoices > 0}
            />
          </div>
        </section>
      )}

      <h2 className="text-sm font-semibold text-zinc-900">Catalog</h2>
      {counts.loading && <LoadingState />}
      {counts.error && <ErrorState message={counts.error} onRetry={counts.reload} />}
      {counts.data && (
        <section aria-label="Catalog summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Products" value={counts.data.products} href="/admin/products" />
          <KpiCard
            label="Archived products"
            value={counts.data.archivedProducts}
            href="/admin/products"
          />
          <KpiCard label="Subscription plans" value={counts.data.plans} href="/admin/plans" />
          <KpiCard
            label="Plans open for sale today"
            value={counts.data.offerablePlans}
            href="/admin/plans"
          />
        </section>
      )}

      <section aria-label="Rules and reports" className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Rules and reports</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ADMIN_MODULES.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
            >
              <p className="text-sm font-semibold text-zinc-900">{module.label}</p>
              <p className="mt-1 text-sm text-zinc-500">{module.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            counts.reload();
            business.reload();
          }}
        >
          Refresh figures
        </Button>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  href,
  note,
  alert = false,
}: {
  label: string;
  value: number | string;
  href: string;
  note?: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
    >
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      {note && <p className={`mt-1 text-xs ${alert ? "text-red-600" : "text-zinc-500"}`}>{note}</p>}
    </Link>
  );
}
