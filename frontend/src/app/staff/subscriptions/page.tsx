"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  CustomerCell,
  ButtonLink,
  inputClass,
  LoadingRow,
  PageHeader,
  Pagination,
  SubscriptionStatusBadge,
  TableShell,
} from "@/components/staff/ui";
import { FREQUENCY_LABEL, formatDate, formatMoney, SUBSCRIPTION_STATUS_LABEL } from "@/lib/format";
import { listSubscriptions, type SubscriptionStatus } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

const STATUSES = Object.keys(SUBSCRIPTION_STATUS_LABEL) as SubscriptionStatus[];
const PAGE_SIZE = 20;

export default function SubscriptionsPage() {
  const [status, setStatus] = useState<SubscriptionStatus | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const list = useApiData(
    () => listSubscriptions({ status, search: query, page }),
    [status, query, page],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations & subscriptions"
        description="Every offer and subscription moves through Draft, Quotation, Confirmed, Active and Closed."
        actions={<ButtonLink href="/staff/subscriptions/new">New quotation</ButtonLink>}
      />

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <div className="w-full sm:w-72">
          <label htmlFor="search" className="block text-xs font-medium text-zinc-600">
            Search
          </label>
          <input
            id="search"
            type="search"
            placeholder="Number, plan or customer email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-zinc-600">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as SubscriptionStatus | "");
            }}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUBSCRIPTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Search
        </button>
      </form>

      {list.error && <Alert>{list.error}</Alert>}
      {!list.data ? (
        !list.error && <LoadingRow />
      ) : (
        <>
          <TableShell
            isEmpty={list.data.items.length === 0}
            empty={
              query || status ? (
                "No quotations or subscriptions match these filters."
              ) : (
                <>
                  No quotations yet.{" "}
                  <Link href="/staff/subscriptions/new" className="font-medium text-indigo-600">
                    Create the first one
                  </Link>
                  .
                </>
              )
            }
            head={
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Next billing</th>
                <th className="px-4 py-3 text-right">Total / cycle</th>
              </tr>
            }
          >
            {list.data.items.map((sub) => (
              <tr key={sub.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/staff/subscriptions/${sub.id}`}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    {sub.number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <CustomerCell
                    customer={sub.customer}
                    href={`/staff/customers/${sub.customer.id}`}
                  />
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {sub.plan_name}
                  <span className="block text-xs text-zinc-500">
                    {FREQUENCY_LABEL[sub.billing_frequency]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <SubscriptionStatusBadge status={sub.status} />
                  {sub.rejected_at && (
                    <span className="block pt-1 text-xs text-red-700">Declined by customer</span>
                  )}
                  {sub.status === "QUOTATION" && sub.quotation_valid_until && (
                    <span className="block pt-1 text-xs text-zinc-500">
                      Valid until {formatDate(sub.quotation_valid_until)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(sub.next_billing_date)}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {formatMoney(sub.total)}
                </td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
