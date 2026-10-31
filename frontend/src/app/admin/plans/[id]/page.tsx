"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { PlanForm } from "@/components/admin/plan-form";
import { Badge, ErrorState, LoadingState } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";
import { adminApi, PLAN_STATUS_LABEL, type Plan } from "@/lib/admin-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const plan = useAsyncData(() => adminApi.getPlan(id), [id]);
  // Local copy so the header reflects a save without another request.
  const [saved, setSaved] = useState<Plan | null>(null);
  const current = saved ?? plan.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {current?.name ?? "Plan"}
          </h1>
          {current && (
            <div className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
              <Badge tone={current.status === "ACTIVE" ? "green" : "zinc"}>
                {PLAN_STATUS_LABEL[current.status]}
              </Badge>
              {current.is_offerable ? (
                <Badge tone="indigo">Open for sale today</Badge>
              ) : (
                <Badge tone="amber">Not open for sale today</Badge>
              )}
            </div>
          )}
        </div>
        <Link href="/admin/plans" className={buttonClass("secondary")}>
          Back to plans
        </Link>
      </div>

      {plan.loading && !current && <LoadingState />}
      {plan.error && <ErrorState message={plan.error} onRetry={plan.reload} />}
      {current && <PlanForm plan={current} onSaved={(updated) => setSaved(updated)} />}
    </div>
  );
}
