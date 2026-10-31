import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { BrandMark, MonoPill } from "@/components/landing/brand-mark";
import { FlowTabs } from "@/components/landing/flow-tabs";
import { HeroWindow } from "@/components/landing/hero-window";
import { BillingTiles, Bento, FeatureStack } from "@/components/landing/showcase";
import { SiteHeader } from "@/components/landing/site-header";

const inter = Inter({
  variable: "--font-landing",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brightloop | Subscription billing that runs itself",
  description:
    "Brightloop quotes, invoices and tracks payments for every subscription plan you sell, while you keep selling.",
};

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const darkButton =
  "press inline-flex h-11 items-center justify-center rounded-[12px] bg-ink px-5 text-[15px] font-medium text-white hover:bg-black focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:outline-none";
const lightButton =
  "press inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-5 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:bg-[#f4f4f1] focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none";

export default function Home() {
  return (
    <div className={`${inter.variable} landing min-h-screen bg-paper text-ink`}>
      <Hero />
      <main>
        <section className="px-4 pt-24 pb-28 text-center sm:px-6 sm:pt-28 sm:pb-36">
          <Heading
            title="Works with every plan you sell."
            lead="Daily to yearly, per seat or per variant, with the discounts, taxes and payment methods you already use."
          />
          <BillingTiles />
        </section>

        <section id="workflow" className="scroll-mt-6 px-4 pb-28 sm:px-6 sm:pb-36">
          <div className="mx-auto max-w-[1120px]">
            <Heading
              title={
                <>
                  One request.
                  <br />
                  Every document after it.
                </>
              }
              lead={
                <>
                  Each tab is one <Marker>real task your staff runs</Marker>, and everything
                  Brightloop produced from it.
                </>
              }
            />
            <div className="mt-12">
              <FlowTabs />
            </div>
          </div>
        </section>

        <section className="px-4 pb-28 sm:px-6 sm:pb-36">
          <div className="mx-auto max-w-[1120px]">
            <Heading
              title={
                <>
                  Handle billing you&rsquo;d
                  <br />
                  <em className="italic">never</em> do by hand.
                </>
              }
              lead="Variant prices, capped promos, split taxes and plan switches. Each one is a few fields in Brightloop."
            />
            <Bento />
          </div>
        </section>

        <section id="features" className="scroll-mt-6 px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="flex justify-center">
              <MonoPill>Can&rsquo;t this just be a spreadsheet?</MonoPill>
            </div>
            <div className="mt-6">
              <Heading
                title={
                  <>
                    Things a spreadsheet
                    <br />
                    can&rsquo;t do alone.
                  </>
                }
                lead="Every state tracked, every cycle invoiced once, every role kept in its lane."
              />
            </div>
            <FeatureStack />
            <p className="mt-16 text-center text-[18px] text-muted">
              Your team still runs the business. Brightloop keeps the books straight.
            </p>
          </div>
        </section>

        <Difference />
        <Faq />
        <Team />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- Hero */

function Hero() {
  return (
    <div className="p-2 sm:p-3">
      <div className="relative overflow-hidden rounded-[20px] bg-[#f3f3ef] pb-10 sm:rounded-[24px] sm:pb-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(80%_70%_at_50%_100%,#e6dcfb_0%,#efe9fb_45%,transparent_80%)]"
        />
        <SiteHeader />
        <section className="relative px-4 pt-10 text-center sm:px-6 sm:pt-14">
          <h1
            className="rise mx-auto max-w-[900px] text-[clamp(2.25rem,5.2vw,3.25rem)] leading-[1.04] font-medium tracking-[-0.03em] text-ink"
            style={delay(0)}
          >
            What if{" "}
            <span className="inline-flex translate-y-[0.08em] items-center gap-2 align-baseline">
              <BrandMark className="size-[0.9em]" />
              Brightloop
            </span>
            <br className="hidden sm:block" /> sent every invoice on time?
          </h1>
          <p
            className="rise mx-auto mt-6 max-w-[640px] text-[17px] leading-[1.55] text-muted sm:text-[18px]"
            style={delay(100)}
          >
            Brightloop is a{" "}
            <a href="#workflow" className="rounded-[3px] bg-marker px-1 text-ink">
              fully automated ›
            </a>{" "}
            billing system for subscriptions.
            <br className="hidden sm:block" /> It quotes, invoices and tracks payments while you keep
            selling.
          </p>
          <div
            className="rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={delay(200)}
          >
            <Link href="/signup" className={darkButton}>
              Get started
            </Link>
            <a href="#workflow" className={lightButton}>
              See what it can do <span aria-hidden="true">›</span>
            </a>
          </div>

          <HeroWindow />
        </section>
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-[13px] text-muted">
        <svg viewBox="0 0 30 34" className="-mt-5 h-8 w-7 text-ink/70" aria-hidden="true">
          <path
            d="M24 30C14 29 7 22 6 4M6 4 2 10M6 4l5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        The staff billing view in
        <span className="inline-flex items-center gap-1 font-medium text-ink">
          <BrandMark className="size-4" /> Brightloop
        </span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Difference */

function Difference() {
  return (
    <section className="px-4 pb-28 sm:px-6 sm:pb-36">
      <div className="mx-auto max-w-[1120px] rounded-[24px] border border-dashed border-black/15 px-6 py-16 text-center sm:py-20">
        <BrandMark className="mx-auto size-16 drop-shadow-[0_8px_16px_rgb(67_56_202/0.3)]" />
        <h2 className="mt-8 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.04] font-normal tracking-[-0.03em]">
          What makes Brightloop different.
        </h2>
        <p className="mt-5 text-[17px] text-muted">Not a bigger spreadsheet. Not a whole ERP.</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <VersusChip icon={<BrandMark className="size-5" />} label="Brightloop" />
          <span className="font-mono text-[10px] tracking-[0.1em] text-muted">VERSUS</span>
          <VersusChip icon={<span className="size-3 rounded-[3px] bg-emerald-600" />} label="Spreadsheets" />
          <VersusChip icon={<span className="size-3 rounded-full ring-[3px] ring-violet-500 ring-inset" />} label="Full ERP suites" />
        </div>

        <p className="mx-auto mt-12 max-w-[560px] text-[22px] leading-snug tracking-[-0.01em]">
          Brightloop is a truly{" "}
          <span className="relative inline-block">
            subscription-first
            <svg
              viewBox="0 0 120 8"
              preserveAspectRatio="none"
              className="absolute -bottom-2 left-0 h-2 w-full text-emerald-500"
              aria-hidden="true"
            >
              <path
                d="M1 5c10-4 20 4 30 0s20-4 30 0 20 4 30 0 20-4 28 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          billing system.
        </p>
        <div className="mx-auto mt-6 max-w-[620px] space-y-5 text-[17px] leading-[1.6] text-muted">
          <p>
            It&rsquo;s for teams who sell on a schedule and would rather not chase renewals in
            rows and columns. Perfect if you run plans, send quotes, or bill the same customers
            every month.
          </p>
          <p>
            Spreadsheets are great for one-off math, and ERP suites are great for running a
            factory. Brightloop is for the billing in between.
          </p>
        </div>
        <a href="#workflow" className={`${lightButton} mt-9`}>
          See how a billing day runs →
        </a>
      </div>
    </section>
  );
}

function VersusChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[14px] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_2px_6px_rgb(0_0_0/0.05)]">
      {icon}
      {label}
    </span>
  );
}

/* ----------------------------------------------------------------- FAQ */

const QA = [
  {
    q: "Can't we keep doing this in spreadsheets?",
    a: "You can, it's just a lot of work. You'd track renewals by hand, recalculate tax on every invoice and hope no one bills twice. Brightloop does all of that on schedule.",
  },
  {
    q: "Does it handle taxes and discounts?",
    a: "Yes. Set tax rules once and they apply to the right products. Discounts can be fixed or percentage, with minimums, end dates and usage limits.",
  },
  {
    q: "Who can see what?",
    a: "Admins manage the catalog, staff and reports. Staff run customers, quotes, invoices and payments. Customers only see their own subscriptions and invoices.",
  },
  {
    q: "Will it slow down as we grow?",
    a: "It's built for thousands of subscriptions, with pages that load in under two seconds.",
  },
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-6 px-4 pb-28 sm:px-6 sm:pb-36">
      <Heading title="Fair questions." />
      <div className="mx-auto mt-10 max-w-[540px] rounded-[20px] border border-transparent bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_16px_40px_-20px_rgb(0_0_0/0.15)] sm:p-5">
        <div className="flex items-center gap-2 border-b border-black/[0.06] pb-3">
          <BrandMark className="size-6" />
          <span className="text-[14px] font-medium">Brightloop</span>
        </div>
        <dl className="mt-4 space-y-3 text-[14px] leading-snug">
          {QA.map(({ q, a }) => (
            <div key={q} className="space-y-3">
              <dt className="flex justify-end">
                <span className="relative max-w-[80%] rounded-[18px] bg-bubble px-3.5 py-2 text-white after:absolute after:right-[-4px] after:bottom-0 after:size-3 after:bg-bubble after:[clip-path:polygon(0_0,100%_100%,0_100%)]">
                  {q}
                </span>
              </dt>
              <dd className="flex items-end gap-2">
                <BrandMark className="size-6 shrink-0" />
                <span className="max-w-[85%] rounded-[18px] bg-[#efeee9] px-3.5 py-2 text-ink">{a}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Team */

function Team() {
  return (
    <section className="px-4 pb-28 sm:px-6 sm:pb-36">
      <div className="mx-auto grid max-w-[1120px] items-center gap-12 rounded-[24px] border border-transparent bg-white p-8 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_24px_60px_-30px_rgb(0_0_0/0.2)] sm:p-14 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.05] font-normal tracking-[-0.03em]">
            Hi, we&rsquo;re Brightloop <span aria-hidden="true">👋</span>
          </h2>
          <div className="mt-6 space-y-4 text-[17px] leading-[1.6] text-muted">
            <p>
              We kept meeting teams that sold subscriptions and billed them from spreadsheets.
              Change one price and forty invoices are wrong.
            </p>
            <p>
              So we built one place for the whole loop: the admin who sets prices, the staff who
              send quotes and collect payments, and the customer who just wants their invoice.
            </p>
            <p>We hope it gives your team back the hours billing used to take.</p>
          </div>
          <Link href="/login" className={`${lightButton} mt-8`}>
            Open the app →
          </Link>
          <div className="mt-8 flex items-center gap-3">
            <BrandMark className="size-10" />
            <div>
              <p className="text-[14px] font-medium">The Brightloop team</p>
              <p className="text-[13px] text-muted">Brightloop Software</p>
            </div>
          </div>
        </div>

        <figure>
          <div className="relative mx-auto h-[280px] w-full max-w-[340px]" aria-hidden="true">
            {[
              ["ink", "-rotate-[8deg] left-[4%] top-[6%]", "Admin"],
              ["sky", "rotate-[6deg] right-[2%] top-0", "Staff"],
              ["dusk", "-rotate-[4deg] left-0 bottom-[2%]", "Portal"],
              ["meadow", "rotate-[8deg] right-[6%] bottom-[8%]", "Reports"],
            ].map(([tone, pos, label]) => (
              <div
                key={label}
                className={`absolute flex size-[104px] flex-col items-center justify-center gap-2 rounded-[24px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_14px_30px_-12px_rgb(0_0_0/0.3)] ${pos}`}
              >
                <BrandMark tone={tone as "ink" | "sky" | "dusk" | "meadow"} className="size-12" />
                <span className="text-[12px] font-medium">{label}</span>
              </div>
            ))}
            <BrandMark className="absolute top-1/2 left-1/2 size-[120px] -translate-1/2 drop-shadow-[0_16px_24px_rgb(67_56_202/0.35)]" />
          </div>
          <figcaption className="mt-6 text-center text-[13px] text-muted">
            Admin, Staff, Customer portal and Reports, in one system.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Closing CTA */

function ClosingCta() {
  return (
    <section className="px-4 pb-28 text-center sm:px-6 sm:pb-32">
      <BrandMark className="mx-auto size-16 drop-shadow-[0_8px_16px_rgb(67_56_202/0.3)]" />
      <h2 className="mt-6 text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.04] font-normal tracking-[-0.03em]">
        Let your invoices send themselves.
      </h2>
      <Link href="/signup" className={`${darkButton} mt-8 h-12 px-6 text-[16px]`}>
        Get started
      </Link>
      <p className="mt-5 text-[14px] text-muted">Subscription billing for your whole team.</p>
    </section>
  );
}

/* -------------------------------------------------------------- Footer */

const FOOTER_LINKS = [
  { label: "How it works", href: "#workflow" },
  { label: "Features", href: "#features" },
  { label: "Questions", href: "#faq" },
  { label: "Log in", href: "/login" },
  { label: "Get started", href: "/signup" },
];

function SiteFooter() {
  return (
    <footer className="bg-white px-6 pt-10 pb-8 font-mono text-[12px] tracking-[0.06em] uppercase sm:px-16">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-ink">Pages</p>
          <ul className="mt-3 space-y-2">
            {FOOTER_LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="text-muted transition-colors duration-150 hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <BrandMark tone="dusk" className="size-14 drop-shadow-[0_6px_12px_rgb(0_0_0/0.15)]" />
      </div>
      <div className="mt-8 flex flex-col justify-between gap-2 border-t border-black/[0.06] pt-6 sm:flex-row">
        <p className="text-ink">Brightloop © 2026</p>
        <p className="text-muted">Subscriptions, invoices and payments in one place</p>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------- Shared */

function Heading({ title, lead }: { title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mx-auto max-w-[900px] text-center">
      <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.04] font-normal tracking-[-0.03em] text-ink">
        {title}
      </h2>
      {lead && (
        <p className="mx-auto mt-5 max-w-[640px] text-[17px] leading-[1.55] text-muted sm:text-[18px]">
          {lead}
        </p>
      )}
    </div>
  );
}

function Marker({ children }: { children: ReactNode }) {
  return <span className="rounded-[3px] bg-marker px-1 text-ink">{children}</span>;
}
