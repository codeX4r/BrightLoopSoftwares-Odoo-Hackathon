import type { CSSProperties } from "react";

import { BrandMark } from "./brand-mark";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

type Shot = { label: string; wash: string; doc: string; amount: string; tag: string };

const GROUPS: { title: string; count: string; tone: "loop" | "ink"; shots: Shot[] }[] = [
  {
    title: "Billing run",
    count: "3 in progress",
    tone: "loop",
    shots: [
      { label: "Northwind Studio, monthly", wash: "wash-mist", doc: "INV-2026-0118", amount: "₹21,758.26", tag: "Generating invoice" },
      { label: "Kite & Co., weekly", wash: "wash-lavender", doc: "INV-2026-0119", amount: "₹8,850.00", tag: "Applying discount" },
      { label: "Hollow Pine Labs, yearly", wash: "wash-sky", doc: "INV-2026-0120", amount: "₹1,41,600.00", tag: "Adding GST 18%" },
    ],
  },
  {
    title: "Quotations",
    count: "3 awaiting",
    tone: "ink",
    shots: [
      { label: "Fernbrook Cafe, monthly", wash: "wash-meadow", doc: "Q-2026-0042", amount: "₹4,720.00", tag: "Sent to customer" },
      { label: "Ostra Health, yearly", wash: "wash-meadow", doc: "Q-2026-0043", amount: "₹96,000.00", tag: "Confirmed" },
      { label: "Lumen Press, monthly", wash: "wash-dusk", doc: "Q-2026-0044", amount: "₹12,980.00", tag: "Becoming active" },
    ],
  },
];

function MiniDoc({ doc, amount }: { doc: string; amount: string }) {
  return (
    <div className="w-[58%] rounded-[8px] bg-white p-2.5 shadow-[0_8px_20px_-8px_rgb(0_0_0/0.25)] sm:p-3">
      <p className="font-mono text-[8px] text-muted sm:text-[9px]">{doc}</p>
      <div className="mt-2 space-y-1">
        <div className="h-1 w-full rounded-full bg-black/[0.07]" />
        <div className="h-1 w-4/5 rounded-full bg-black/[0.07]" />
        <div className="h-1 w-3/5 rounded-full bg-black/[0.07]" />
      </div>
      <p className="mt-2 text-right text-[10px] font-semibold text-ink tabular-nums sm:text-[11px]">
        {amount}
      </p>
    </div>
  );
}

/** The staff billing view, drawn as a Mac window of live tasks. */
export function HeroWindow() {
  return (
    <div
      className="rise mx-auto mt-14 max-w-[1120px] overflow-hidden text-left rounded-[12px] border border-transparent bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_24px_60px_-20px_rgb(40_20_90/0.25)]"
      style={delay(300)}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-black/[0.06] px-3" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="space-y-7 px-5 py-6 sm:px-14 sm:py-8">
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            <div className="flex items-center gap-2 text-[12px]">
              <BrandMark tone={g.tone} className="size-4" />
              <span className="font-medium text-ink">{g.title}</span>
              <span className="text-muted">{g.count} ›</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {g.shots.map((s, si) => (
                <div key={s.doc} className={si > 0 ? "hidden sm:block" : ""}>
                  <p className="mb-1.5 truncate text-[11px] text-ink/80">↳ {s.label}</p>
                  <div
                    className={`rise rise-row relative flex aspect-[16/9] items-center justify-center rounded-[6px] ${s.wash} shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)]`}
                    style={delay(600 + gi * 300 + si * 100)}
                  >
                    <MiniDoc doc={s.doc} amount={s.amount} />
                    <span className="absolute top-[18%] left-[10%] flex items-center gap-1">
                      <svg viewBox="0 0 10 10" className="size-2.5 text-[#7b61ff]" aria-hidden="true">
                        <path d="M1 1l8 3.5-3.5 1L4 9z" fill="currentColor" />
                      </svg>
                      <span className="rounded-[4px] bg-[#7b61ff] px-1.5 py-0.5 text-[9px] font-medium whitespace-nowrap text-white sm:text-[10px]">
                        {s.tag}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
