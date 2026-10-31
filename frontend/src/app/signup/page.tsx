import type { Metadata } from "next";

import { AuthFrame } from "@/components/auth/auth-frame";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account | Brightloop",
};

export default function SignupPage() {
  return (
    <AuthFrame
      switchPrompt="Already have an account?"
      switchLabel="Log in"
      switchHref="/login"
      asideTitle="Your subscriptions and invoices, in one place."
      asideLead="Review quotations, follow your plans and see exactly what you owe, any time."
    >
      <h1 className="text-[32px] leading-[1.1] font-medium tracking-[-0.03em]">
        Create your account
      </h1>
      <p className="mt-2 text-[16px] text-muted">
        For customers. Staff and admin accounts come from your admin.
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
    </AuthFrame>
  );
}
