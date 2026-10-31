"use client";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PageHeader } from "@/components/staff/ui";
import { changeStaffPassword } from "@/lib/staff-api";

// Staff and admin: at least 12 characters (see app/schemas/account.py).
const STAFF_MIN_PASSWORD_LENGTH = 12;

export default function StaffAccount() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Change the password you use to sign in." />
      <ChangePasswordForm minLength={STAFF_MIN_PASSWORD_LENGTH} onSubmit={changeStaffPassword} />
    </div>
  );
}
