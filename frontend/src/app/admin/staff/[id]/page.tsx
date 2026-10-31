"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ActiveBadge, StatusChangeDialog } from "@/components/admin/account-ui";
import { Panel, PaymentsTable, Stat } from "@/components/admin/detail-ui";
import { Button, buttonClass } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { peopleApi } from "@/lib/admin-api";
import { formatDate, formatINR } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const staff = useAsyncData(() => peopleApi.getStaff(id), [id]);
  const [toggling, setToggling] = useState(false);
  const s = staff.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight break-all text-zinc-900">
            {s?.email ?? "Staff member"}
          </h1>
          {s && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
              <ActiveBadge active={s.is_active} />
              <span>Added {formatDate(s.created_at)}</span>
              <span className="font-mono text-xs text-zinc-400">ID {s.id}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {s && (
            <Button variant="secondary" onClick={() => setToggling(true)}>
              {s.is_active ? "Deactivate" : "Activate"}
            </Button>
          )}
          <Link href="/admin/staff" className={buttonClass("secondary")}>
            Back to staff
          </Link>
        </div>
      </div>

      {staff.loading && !s && <LoadingState />}
      {staff.error && <ErrorState message={staff.error} onRetry={staff.reload} />}

      {s && (
        <>
          <section aria-label="Staff figures" className="grid gap-4 sm:grid-cols-3">
            <Stat label="Subscriptions created" value={String(s.figures.subscriptions_created)} />
            <Stat label="Payments recorded" value={String(s.figures.payments_recorded)} />
            <Stat label="Amount recorded" value={formatINR(s.figures.payments_amount)} />
          </section>

          <Panel title="Payments recorded recently">
            <PaymentsTable payments={s.recent_payments} />
          </Panel>
        </>
      )}

      <StatusChangeDialog
        account={toggling && s ? s : null}
        onClose={() => setToggling(false)}
        onChanged={staff.reload}
      />
    </div>
  );
}
