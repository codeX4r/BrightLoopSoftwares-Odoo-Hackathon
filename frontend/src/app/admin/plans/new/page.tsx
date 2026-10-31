"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PlanForm } from "@/components/admin/plan-form";
import { buttonClass } from "@/components/ui/button";

export default function NewPlanPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">New plan</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Plans can only be sold while they are active and in their availability window.
          </p>
        </div>
        <Link href="/admin/plans" className={buttonClass("secondary")}>
          Back to plans
        </Link>
      </div>
      <PlanForm onSaved={(plan) => router.replace(`/admin/plans/${plan.id}`)} />
    </div>
  );
}
