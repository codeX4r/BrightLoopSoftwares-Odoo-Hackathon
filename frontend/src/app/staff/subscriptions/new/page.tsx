"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SubscriptionForm } from "@/components/staff/subscription-form";
import { PageHeader } from "@/components/staff/ui";
import { createSubscription } from "@/lib/staff-api";

export default function NewSubscriptionPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Link href="/staff/subscriptions" className="text-sm text-indigo-600 hover:text-indigo-500">
        ← Quotations & subscriptions
      </Link>
      <PageHeader
        title="New quotation"
        description="Saved as a draft. Send it to the customer when it's ready."
      />
      <SubscriptionForm
        submitLabel="Save draft"
        onSubmit={async (input) => {
          const created = await createSubscription(input);
          router.replace(`/staff/subscriptions/${created.id}`);
        }}
      />
    </div>
  );
}
