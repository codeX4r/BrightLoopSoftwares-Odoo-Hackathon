import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { BILLING_ICONS } from "@/components/landing/billing-icons";
import { BrandMark } from "@/components/landing/brand-mark";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

type AuthFrameProps = {
  /** Small link in the top-right corner, e.g. to switch between sign-in and sign-up. */
  switchPrompt: string;
  switchLabel: string;
  switchHref: string;
  /** Headline on the illustrated side. */
  asideTitle: ReactNode;
  asideLead: string;
  children: ReactNode;
};

/**
 * Sign-in and sign-up share this frame. The left column holds the form; the right column
 * continues the landing page hero: warm panel, lavender glow and the same product cards.
 */
export function AuthFrame({
  switchPrompt,
  switchLabel,
  switchHref,
  asideTitle,
  asideLead,
  children,
}: AuthFrameProps) {
  return (
    <main className="min-h-screen bg-paper p-2 text-ink sm:p-3 lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-3">
      <section className="flex min-h-[calc(100vh-1rem)] flex-col px-3 sm:min-h-[calc(100vh-1.5rem)] sm:px-6">
        <header className="flex h-[64px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Brightloop home">
            <BrandMark className="size-7" />
            <span className="text-[19px] font-medium tracking-[-0.03em]">brightloop</span>
          </Link>
          <p className="text-[14px] text-muted">
            <span className="hidden sm:inline">{switchPrompt} </span>
            <Link href={switchHref} className="font-medium text-ink hover:underline">
              {switchLabel}
            </Link>
          </p>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="rise w-full max-w-[400px]" style={delay(0)}>
            {children}
          </div>
        </div>

        <footer className="flex items-center justify-between py-4 font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
          <span>Brightloop © 2026</span>
          <Link href="/" className="hover:text-ink">
            Back to site
          </Link>
        </footer>
      </section>

      <aside className="relative hidden overflow-hidden rounded-[24px] bg-[#f3f3ef] lg:flex lg:flex-col lg:justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[75%] bg-[radial-gradient(80%_70%_at_50%_100%,#e6dcfb_0%,#efe9fb_45%,transparent_80%)]"
        />
        <div className="relative mx-auto w-full max-w-[520px] px-10 py-16">
          <h2
            className="rise text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.06] font-medium tracking-[-0.03em]"
            style={delay(100)}
          >
            {asideTitle}
          </h2>
          <p className="rise mt-4 max-w-[440px] text-[17px] leading-[1.55] text-muted" style={delay(150)}>
            {asideLead}
          </p>
          <AuthShowcase />
        </div>
      </aside>
    </main>
  );
}

const SHOWCASE_ICONS = ["monthly", "invoices", "taxes", "cash", "renew"] as const;

/** The billing loop in three cards: what staff asked, what Brightloop did, what came out. */
function AuthShowcase() {
  return (
    <div className="mt-10" aria-hidden="true">
      <div
        className="rise rounded-[14px] bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.15)]"
        style={delay(250)}
      >
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#e9e7df] font-mono text-[11px]">
            S
          </span>
          <div>
            <p className="font-mono text-[11px] text-muted">Staff, to Brightloop</p>
            <p className="mt-1 text-[15px] leading-snug">Run billing for everything due today.</p>
          </div>
        </div>
      </div>

      <Connector />

      <div
        className="rise rounded-[14px] bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.15)]"
        style={delay(350)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark className="size-6" />
            <p className="text-[14px] font-medium">Brightloop</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Done
          </span>
        </div>
        <ul className="mt-3 space-y-1.5 text-[13px] text-ink/80">
          {["Found 18 subscriptions due", "Skipped 2 already invoiced", "Generated 16 invoices"].map(
            (s) => (
              <li key={s} className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="size-3.5 text-emerald-600">
                  <path
                    d="m3.5 8.5 3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {s}
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="rise mt-8 flex gap-3" style={delay(450)}>
        {SHOWCASE_ICONS.map((icon) => (
          <span key={icon} className="block size-12 drop-shadow-[0_6px_10px_rgb(0_0_0/0.14)]">
            {BILLING_ICONS[icon]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Connector() {
  return (
    <svg viewBox="0 0 10 24" className="mx-auto my-1 h-6 w-2.5 text-black/20">
      <path d="M5 0v20M1.5 16.5 5 20l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Shared control styles for the sign-in and sign-up forms. */
export const authInput =
  "block w-full rounded-[12px] border bg-white px-3.5 py-3 text-[15px] text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] placeholder:text-black/30 focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone";

export function authInputState(hasError: boolean) {
  return hasError
    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
    : "border-black/10 focus:border-loop/60 focus:ring-loop/10";
}

export const authSubmit =
  "press flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-ink text-[15px] font-medium text-white hover:bg-black focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70";

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-[12px] bg-red-50 px-4 py-3 text-[14px] leading-snug text-red-700 shadow-[inset_0_0_0_1px_rgb(220_38_38/0.15)]"
    >
      <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4ZM10 14.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

export function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[12px] text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-loop/40 focus-visible:outline-none"
    >
      <svg
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {shown ? (
          <>
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </>
        ) : (
          <>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
    </button>
  );
}
