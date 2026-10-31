"use client";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { usePortalUser } from "@/components/portal/portal-shell";
import { Card, DetailList, PageHeader } from "@/components/staff/ui";
import { formatDateTime } from "@/lib/format";
import { changePassword } from "@/lib/portal-api";

// Customers use the signup rule: more than 8 characters (see app/schemas/account.py).
const CUSTOMER_MIN_PASSWORD_LENGTH = 9;

export default function AccountSettings() {
  const user = usePortalUser();
  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Your sign-in details." />
      <Card title="Profile">
        <DetailList
          items={[
            ["Email", user.email],
            ["Account type", "Customer"],
            ["Member since", formatDateTime(user.created_at)],
          ]}
        />
      </Card>
      <ChangePasswordForm minLength={CUSTOMER_MIN_PASSWORD_LENGTH} onSubmit={changePassword} />
    </div>
  );
}
