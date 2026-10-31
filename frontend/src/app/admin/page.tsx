"use client";

import Link from "next/link";

import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { adminApi } from "@/lib/admin-api";
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

const PENDING_MODULES = [
  { label: "Customers", note: "Customer accounts and profiles" },
  { label: "Subscriptions", note: "Lifecycle, renewals and closures" },
  { label: "Invoices", note: "Recurring billing and invoice status" },
  { label: "Payments", note: "Recorded payments and outstanding balances" },
  { label: "Revenue reports", note: "Collected cash, invoiced amounts and receivables" },
];

export default function AdminDashboardPage() {
  const counts = useAsyncData(loadCounts, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Catalog overview. Figures come straight from the database.
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

      <section aria-label="Modules not built yet">
        <h2 className="text-sm font-semibold text-zinc-900">Not built yet</h2>
        <p className="mt-1 text-sm text-zinc-500">
          These figures appear once their backend modules exist. Until then, no numbers are shown.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PENDING_MODULES.map((module) => (
            <li
              key={module.label}
              className="rounded-xl border border-dashed border-zinc-300 bg-white p-5"
            >
              <p className="text-sm font-semibold text-zinc-700">{module.label}</p>
              <p className="mt-1 text-sm text-zinc-500">{module.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <Button variant="ghost" size="sm" onClick={counts.reload}>
          Refresh figures
        </Button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
    >
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{value}</p>
    </Link>
  );
}
