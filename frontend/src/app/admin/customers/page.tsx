"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ActiveBadge, NewAccountModal, StatusChangeDialog } from "@/components/admin/account-ui";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { peopleApi, type CustomerRow } from "@/lib/admin-api";
import { formatDate, formatINR } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<CustomerRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const customers = useAsyncData(
    () =>
      peopleApi.listCustomers({
        q,
        is_active: active === "" ? undefined : active === "true",
        limit: PAGE_SIZE,
        offset,
      }),
    [q, active, offset],
  );

  const filtersActive = Boolean(q || active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Customers</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Customer accounts with their subscriptions, invoices and payments.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New customer</Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_180px]">
        <input
          aria-label="Search customers"
          type="search"
          placeholder="Search by email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass()}
        />
        <select
          aria-label="Filter by account status"
          value={active}
          onChange={(e) => {
            setActive(e.target.value as "" | "true" | "false");
            setOffset(0);
          }}
          className={inputClass()}
        >
          <option value="">All accounts</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {customers.loading && !customers.data && <LoadingState />}
      {customers.error && <ErrorState message={customers.error} onRetry={customers.reload} />}

      {customers.data && customers.data.total === 0 && (
        <EmptyState
          title={filtersActive ? "No customers match these filters" : "No customers yet"}
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "Customers appear here when they sign up or when you create an account."
          }
          action={!filtersActive && <Button onClick={() => setCreating(true)}>New customer</Button>}
        />
      )}

      {customers.data && customers.data.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Active subs</th>
                <th className="px-4 py-3 text-right">Invoiced</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customers.data.items.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{c.email}</p>
                    <p className="text-xs text-zinc-500">Since {formatDate(c.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={c.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.figures.active_subscriptions}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatINR(c.figures.invoiced_amount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatINR(c.figures.paid_amount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatINR(c.figures.outstanding_amount)}
                    {c.figures.overdue_invoices > 0 && (
                      <span className="block text-xs text-red-600">
                        {c.figures.overdue_invoices} overdue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        View
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setToggling(c)}>
                        {c.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {customers.data && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={customers.data.total}
          onChange={setOffset}
        />
      )}

      {creating && (
        <NewAccountModal
          kind="customer"
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            const created = await peopleApi.createCustomer(input);
            setCreating(false);
            router.push(`/admin/customers/${created.id}`);
          }}
        />
      )}

      <StatusChangeDialog
        account={toggling}
        onClose={() => setToggling(null)}
        onChanged={customers.reload}
      />
    </div>
  );
}
