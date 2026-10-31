import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account | Brightloop Software",
};

export default function SignupPage() {
  return (
    <main className="flex min-h-screen bg-zinc-50 font-sans">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-12 lg:flex">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 h-96 w-96 rounded-full border-[48px] border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full border-[40px] border-white/5"
        />
        <BrandLogo tone="light" />
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-white">
            Your subscriptions and invoices, in one place.
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Create a customer account to review quotations, track your subscriptions and see what
            you owe.
          </p>
        </div>
        <p className="relative text-sm text-indigo-200">© Brightloop Software</p>
      </section>

      <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <BrandLogo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Create your customer account
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Staff and admin accounts are created by your administrator.
          </p>
          <div className="mt-8">
            <SignupForm />
          </div>
          <p className="mt-6 text-center text-sm text-zinc-600">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
