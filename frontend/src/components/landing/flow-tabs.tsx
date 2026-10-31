"use client";

import { MotionConfig, motion } from "motion/react";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

import { BrandMark } from "./brand-mark";
import { RevenueChart } from "./revenue-chart";

type Row = { meta: [string, string]; title: string; body: string; status?: "paid" | "due" };

type Flow = {
  id: string;
  label: string;
  ask: string;
  steps: string[];
  output: string;
  docLabel: string;
  docTitle: string;
  rows?: Row[];
  custom?: ReactNode;
};

const FLOWS: Flow[] = [
  {
    id: "quotation",
    label: "Quotation",
    ask: "Quote Northwind Studio 12 Pro seats on the Growth plan, monthly, with the annual loyalty discount.",
    steps: [
      "Priced 12 seats from the Growth plan",
      "Applied Annual loyalty, 10% off",
      "Added GST 18% to each line",
    ],
    output: "Quotation Q-2026-0042 sent",
    docLabel: "Northwind Studio · Quotation",
    docTitle: "Growth plan, monthly",
    rows: [
      {
        meta: ["12 ×", "₹1,499"],
        title: "Brightloop Cloud, Pro",
        body: "Per-seat price from the Growth plan, Pro variant included.",
      },
      {
        meta: ["1 ×", "₹2,500"],
        title: "Priority support",
        body: "Add-on product with its own tax rule.",
      },
      {
        meta: ["10%", "−₹2,049"],
        title: "Annual loyalty discount",
        body: "Valid until 31 Dec 2026. Used 41 of 100 times.",
      },
      {
        meta: ["Total", "₹21,758"],
        title: "Valid for 15 days",
        body: "Once Northwind confirms, the subscription goes live and billing starts.",
      },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    ask: "Run billing for everything due today.",
    steps: [
      "Found 18 subscriptions due",
      "Skipped 2 already invoiced this cycle",
      "Generated 16 invoices with taxes",
    ],
    output: "16 invoices ready to send",
    docLabel: "Billing run · 1 Nov 2026",
    docTitle: "16 invoices generated",
    rows: [
      {
        meta: ["SUB-00042", "Monthly"],
        title: "Northwind Studio",
        body: "INV-2026-0118 for ₹21,758.26, due in 15 days.",
      },
      {
        meta: ["SUB-00057", "Weekly"],
        title: "Kite & Co.",
        body: "INV-2026-0119 for ₹8,850.00, 5% promo applied.",
      },
      {
        meta: ["SUB-00061", "Yearly"],
        title: "Hollow Pine Labs",
        body: "INV-2026-0120 for ₹1,41,600.00, renews 1 Nov 2027.",
      },
      {
        meta: ["SUB-00063", "Skipped"],
        title: "Ostra Health",
        body: "Already invoiced for this cycle. No duplicate created.",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    ask: "Record Northwind's bank transfer against their October invoice.",
    steps: [
      "Matched ₹21,758.26 to INV-2026-0118",
      "Marked the invoice as paid",
      "Updated the outstanding balance",
    ],
    output: "Payment PAY-0311 recorded",
    docLabel: "Northwind Studio · Account",
    docTitle: "Nothing outstanding",
    rows: [
      {
        meta: ["2 Oct", "Bank"],
        title: "INV-2026-0118",
        body: "₹21,758.26 received by bank transfer.",
        status: "paid",
      },
      {
        meta: ["1 Sep", "Card"],
        title: "INV-2026-0097",
        body: "₹19,470.00 received by card.",
        status: "paid",
      },
      {
        meta: ["1 Aug", "UPI"],
        title: "INV-2026-0071",
        body: "₹19,470.00 received by UPI.",
        status: "paid",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    ask: "Show revenue for the year and anything that's overdue.",
    steps: [
      "Totalled payments received by month",
      "Listed 23 overdue invoices",
      "Counted 1,284 active subscriptions",
    ],
    output: "Dashboard updated",
    docLabel: "Reports · Last 12 months",
    docTitle: "Revenue is up 85% this year",
    custom: (
      <div className="mt-6">
        <dl className="grid grid-cols-3 gap-4 border-b border-black/[0.06] pb-6">
          {[
            ["Active", "1,284"],
            ["Outstanding", "₹1.9L"],
            ["Overdue", "23"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted font-mono text-[11px]">{k}</dt>
              <dd className="mt-1 text-[22px] font-medium tracking-[-0.02em] tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <RevenueChart />
        </div>
      </div>
    ),
  },
];

const check = (
  <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true">
    <path
      d="m3.5 8.5 3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Pill slides to the new tab and settles with a small overshoot. */
const PILL_SPRING = { type: "spring", duration: 0.5, bounce: 0.35 } as const;

export function FlowTabs() {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const flow = FLOWS[active];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (active + (event.key === "ArrowRight" ? 1 : -1) + FLOWS.length) % FLOWS.length;
    setActive(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  }

  return (
    <div>
      <div className="flex justify-center">
        <MotionConfig reducedMotion="user">
          <div
            role="tablist"
            aria-label="Billing flows"
            onKeyDown={onKeyDown}
            className="bg-stone inline-flex max-w-full overflow-x-auto rounded-full p-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)]"
          >
            {FLOWS.map((f, i) => (
              <button
                key={f.id}
                id={`${baseId}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-controls={`${baseId}-panel`}
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                className={`focus-visible:ring-ink/30 relative rounded-full px-4 py-2 text-[14px] font-medium whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:px-5 ${
                  i === active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {i === active && (
                  <motion.span
                    layoutId={`${baseId}-pill`}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.1)]"
                    transition={PILL_SPRING}
                  />
                )}
                <span className="relative">{f.label}</span>
              </button>
            ))}
          </div>
        </MotionConfig>
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${active}`}
        className="border-stone-line bg-stone mt-6 grid items-center gap-6 rounded-[20px] border p-4 sm:p-6 lg:grid-cols-[0.8fr_auto_1.2fr] lg:gap-4"
      >
        {/* Request → Brightloop → result */}
        <div className="mx-auto w-full max-w-[360px]">
          <div className="rounded-[12px] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
            <div className="flex gap-3">
              <span className="text-ink mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#e9e7df] font-mono text-[11px]">
                S
              </span>
              <div>
                <p className="text-muted font-mono text-[11px]">Staff, to Brightloop</p>
                <p className="text-ink mt-1 text-[15px] leading-snug">{flow.ask}</p>
              </div>
            </div>
          </div>
          <Connector />
          <div className="rounded-[12px] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
            <div className="flex items-center gap-2">
              <BrandMark className="size-6" />
              <p className="text-[14px] font-medium">Brightloop</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {flow.steps.map((s) => (
                <li key={s} className="text-ink/80 flex items-center gap-2 text-[13px]">
                  {check}
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <Connector />
          <p className="text-muted text-center font-mono text-[11px]">{flow.output}</p>
          <p className="text-muted/80 mt-3 text-center font-mono text-[11px]">
            Example from a billing day
          </p>
        </div>

        <svg viewBox="0 0 40 10" className="hidden w-10 text-black/20 lg:block" aria-hidden="true">
          <path d="M0 5h36M32 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Document preview */}
        <div className="rounded-[14px] border border-transparent bg-white p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_32px_-16px_rgb(0_0_0/0.15)] sm:p-7">
          <p className="text-muted font-mono text-[11px]">{flow.docLabel}</p>
          <h3 className="mt-1 text-[22px] font-medium tracking-[-0.02em]">{flow.docTitle}</h3>
          {flow.custom ?? (
            <ul className="mt-5">
              {flow.rows?.map((r) => (
                <li
                  key={r.title}
                  className="grid grid-cols-[84px_1fr] gap-4 border-t border-black/[0.06] py-4 sm:grid-cols-[110px_1fr]"
                >
                  <div className="text-muted font-mono text-[11px] leading-[1.6] tabular-nums">
                    <p>{r.meta[0]}</p>
                    <p>{r.meta[1]}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-[15px] font-medium">
                      {r.title}
                      {r.status === "paid" && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Paid
                        </span>
                      )}
                    </p>
                    <p className="text-muted mt-1 text-[14px] leading-snug">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <svg viewBox="0 0 10 24" className="mx-auto my-1 h-6 w-2.5 text-black/20" aria-hidden="true">
      <path d="M5 0v20M1.5 16.5 5 20l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
