"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ActiveBadge, NewAccountModal, StatusChangeDialog } from "@/components/admin/account-ui";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, Pagination } from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/field";
import { peopleApi, type StaffRow } from "@/lib/admin-api";
import { formatDate, formatINR } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const PAGE_SIZE = 10;

export default function StaffPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<StaffRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const staff = useAsyncData(
    () =>
      peopleApi.listStaff({
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Staff management</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Staff run quotations, subscriptions, invoices and payments. Only admins can add staff.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New staff member</Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_180px]">
        <input
          aria-label="Search staff"
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

      {staff.loading && !staff.data && <LoadingState />}
      {staff.error && <ErrorState message={staff.error} onRetry={staff.reload} />}

      {staff.data && staff.data.total === 0 && (
        <EmptyState
          title={filtersActive ? "No staff match these filters" : "No staff yet"}
          description={
            filtersActive
              ? "Try a different search or clear the filters."
              : "Add your first staff member."
          }
          action={
            !filtersActive && <Button onClick={() => setCreating(true)}>New staff member</Button>
          }
        />
      )}

      {staff.data && staff.data.total > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Subscriptions created</th>
                <th className="px-4 py-3 text-right">Payments recorded</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {staff.data.items.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{s.email}</p>
                    <p className="text-xs text-zinc-500">Added {formatDate(s.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={s.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.figures.subscriptions_created}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.figures.payments_recorded}
                    <span className="block text-xs text-zinc-500">
                      {formatINR(s.figures.payments_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/staff/${s.id}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        View
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setToggling(s)}>
                        {s.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {staff.data && (
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={staff.data.total}
          onChange={setOffset}
        />
      )}

      {creating && (
        <NewAccountModal
          kind="staff member"
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            const created = await peopleApi.createStaff(input);
            setCreating(false);
            router.push(`/admin/staff/${created.id}`);
          }}
        />
      )}

      <StatusChangeDialog
        account={toggling}
        onClose={() => setToggling(null)}
        onChanged={staff.reload}
      />
    </div>
  );
}
