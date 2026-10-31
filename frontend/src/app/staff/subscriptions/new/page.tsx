"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SubscriptionForm } from "@/components/staff/subscription-form";
import { LoadingRow, PageHeader } from "@/components/staff/ui";
import { createSubscription } from "@/lib/staff-api";

export default function NewSubscriptionPage() {
  return (
    <div className="space-y-6">
      <Link href="/staff/subscriptions" className="text-sm text-indigo-600 hover:text-indigo-500">
        ← Quotations & subscriptions
      </Link>
      <PageHeader
        title="New quotation"
        description="Saved as a draft. Send it to the customer when it's ready."
      />
      <Suspense fallback={<LoadingRow />}>
        <NewQuotation />
      </Suspense>
    </div>
  );
}

/** Reads ?template=<id> (set by "Use" on the templates screen) to preselect a template. */
function NewQuotation() {
  const router = useRouter();
  const templateId = useSearchParams().get("template");
  return (
    <SubscriptionForm
      templateId={templateId}
      submitLabel="Save draft"
      onSubmit={async (input) => {
        const created = await createSubscription(input);
        router.replace(`/staff/subscriptions/${created.id}`);
      }}
    />
  );
}
