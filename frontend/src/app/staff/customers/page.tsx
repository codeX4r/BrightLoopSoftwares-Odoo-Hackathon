"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Alert,
  ButtonLink,
  inputClass,
  LoadingRow,
  PageHeader,
  Pagination,
  TableShell,
} from "@/components/staff/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { listCustomers } from "@/lib/staff-api";
import { useApiData } from "@/lib/use-api-data";

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const list = useApiData(() => listCustomers({ search: query, page }), [query, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who can sign in to the customer portal, with their open balance."
        actions={<ButtonLink href="/staff/customers/new">Add customer</ButtonLink>}
      />

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <div className="w-full sm:w-80">
          <label htmlFor="search" className="block text-xs font-medium text-zinc-600">
            Search
          </label>
          <input
            id="search"
            type="search"
            placeholder="Name, company, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
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
            empty={query ? "No customers match this search." : "No customers yet."}
            head={
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Active subscriptions</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            }
          >
            {list.data.items.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/staff/customers/${c.id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {c.full_name ?? c.company_name ?? c.email}
                  </Link>
                  <span className="block text-xs text-zinc-500">
                    {[c.full_name && c.company_name, c.email].filter(Boolean).join(" · ")}
                    {!c.is_active && <span className="ml-1 text-red-700">· Deactivated</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{c.active_subscriptions}</td>
                <td
                  className={`px-4 py-3 text-right font-medium ${Number(c.outstanding_amount) > 0 ? "text-zinc-900" : "text-zinc-400"}`}
                >
                  {formatMoney(c.outstanding_amount)}
                </td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </TableShell>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
