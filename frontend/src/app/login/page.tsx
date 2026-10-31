import type { Metadata } from "next";

import { AuthFrame } from "@/components/auth/auth-frame";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in | Brightloop",
};

export default function LoginPage() {
  return (
    <AuthFrame
      switchPrompt="New customer?"
      switchLabel="Create an account"
      switchHref="/signup"
      asideTitle="Billing that runs while you keep selling."
      asideLead="Quotes, invoices and payments for every plan, in one place for your whole team."
    >
      <h1 className="text-[32px] leading-[1.1] font-medium tracking-[-0.03em]">Welcome back</h1>
      <p className="mt-2 text-[16px] text-muted">Choose how you use Brightloop, then log in.</p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </AuthFrame>
  );
}
