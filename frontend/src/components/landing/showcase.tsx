import { BILLING_ICONS } from "./billing-icons";
import { Bubble, MonoPill } from "./brand-mark";

/* ------------------------------------------------- Billing-model tiles */

type TileItem = { icon: keyof typeof BILLING_ICONS; label: string };

const ROWS: TileItem[][] = [
  [
    { icon: "daily", label: "Daily" },
    { icon: "weekly", label: "Weekly" },
    { icon: "monthly", label: "Monthly" },
    { icon: "yearly", label: "Yearly" },
    { icon: "seat", label: "Per seat" },
    { icon: "variants", label: "Variants" },
    { icon: "quotes", label: "Quotes" },
    { icon: "invoices", label: "Invoices" },
  ],
  [
    { icon: "percent", label: "Percent off" },
    { icon: "fixed", label: "Fixed off" },
    { icon: "taxes", label: "Taxes" },
    { icon: "quantity", label: "Min. quantity" },
    { icon: "addons", label: "Add-ons" },
    { icon: "pause", label: "Pause" },
    { icon: "renew", label: "Renew" },
    { icon: "terms", label: "Net terms" },
  ],
  [
    { icon: "upi", label: "UPI" },
    { icon: "card", label: "Card" },
    { icon: "bank", label: "Bank" },
    { icon: "cash", label: "Cash" },
    { icon: "cheque", label: "Cheque" },
  ],
];

export function BillingTiles() {
  return (
    <div className="mt-14 space-y-7">
      {ROWS.map((row, ri) => (
        <ul
          key={ri}
          className={`mx-auto flex max-w-[760px] flex-wrap justify-center gap-x-6 gap-y-7 sm:gap-x-8 ${
            ri === 2 ? "[mask-image:linear-gradient(to_bottom,black_15%,transparent_100%)]" : ""
          }`}
        >
          {row.map((t) => (
            <li key={t.label} className="flex w-[64px] flex-col items-center gap-2">
              <span className="block size-[60px] drop-shadow-[0_6px_10px_rgb(0_0_0/0.16)]">
                {BILLING_ICONS[t.icon]}
              </span>
              <span className="text-center text-[11px] leading-tight whitespace-nowrap text-muted">
                {t.label}
              </span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- Bento cards */

function BentoCard({
  pill,
  ask,
  wash,
  children,
  className = "",
}: {
  pill: string;
  ask: string;
  wash: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-[20px] border border-stone-line bg-stone p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:gap-2">
        <span className="self-start">
          <MonoPill>{pill}</MonoPill>
        </span>
        <span className="self-end pr-1">
          <Bubble>{ask}</Bubble>
        </span>
      </div>
      <div
        className={`mt-3 flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-[12px] p-5 sm:min-h-[320px] ${wash} shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)]`}
      >
        {children}
      </div>
    </div>
  );
}

const card =
  "rounded-[12px] border border-transparent bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_16px_32px_-16px_rgb(0_0_0/0.25)]";

export function Bento() {
  return (
    <div className="mt-14 grid gap-4 md:grid-cols-[1.4fr_1fr]">
      <BentoCard pill="Variant pricing" ask="Add a Pro variant at ₹300 more per seat" wash="wash-meadow">
        <div className={`${card} w-full max-w-[380px] p-4 text-[13px]`}>
          <p className="font-mono text-[11px] text-muted">Brightloop Cloud · Variants</p>
          {[
            ["Starter", "₹1,199", ""],
            ["Pro", "₹1,499", "+₹300"],
            ["Team", "₹1,899", "+₹700"],
          ].map(([name, price, extra]) => (
            <div
              key={name}
              className={`mt-2 flex items-center justify-between rounded-[8px] px-3 py-2 ${
                name === "Pro" ? "bg-loop/[0.07] ring-1 ring-loop/30" : ""
              }`}
            >
              <span className="font-medium">{name}</span>
              <span className="flex items-center gap-3 tabular-nums">
                <span className="text-muted">{extra}</span>
                {price}
              </span>
            </div>
          ))}
        </div>
      </BentoCard>

      <BentoCard pill="Discount limits" ask="Cap the launch offer at 100 uses" wash="wash-mist">
        <div className="relative w-full max-w-[240px]">
          <div className={`${card} p-4 text-[13px]`}>
            <p className="font-mono text-[11px] text-muted">LAUNCH10</p>
            <p className="mt-1 text-[17px] font-medium">10% off yearly</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full w-[41%] rounded-full bg-loop" />
            </div>
            <p className="mt-2 text-muted">Ends 31 Dec 2026</p>
          </div>
          <div className="absolute -right-4 -bottom-8 flex size-[104px] flex-col items-center justify-center rounded-full border-[3px] border-white bg-white/95 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.35)]">
            <span className="text-[26px] font-semibold tracking-[-0.03em] tabular-nums">41</span>
            <span className="font-mono text-[10px] text-muted">of 100 used</span>
          </div>
        </div>
      </BentoCard>

      <BentoCard pill="Tax breakdowns" ask="Show GST on every invoice line" wash="wash-lavender">
        <div className="relative h-full w-full max-w-[300px]">
          {[
            ["-rotate-6 left-0 top-6", "INV-0119"],
            ["rotate-[5deg] right-0 top-4", "INV-0120"],
          ].map(([pos, id]) => (
            <div key={id} className={`${card} absolute w-[58%] p-3 ${pos}`} aria-hidden="true">
              <p className="font-mono text-[10px] text-muted">{id}</p>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 rounded-full bg-black/[0.06]" />
                <div className="h-1.5 w-4/5 rounded-full bg-black/[0.06]" />
                <div className="h-1.5 w-3/5 rounded-full bg-black/[0.06]" />
              </div>
            </div>
          ))}
          <div className={`${card} absolute top-1/2 left-1/2 w-[72%] -translate-x-1/2 -translate-y-1/2 p-4 text-[12px]`}>
            <p className="font-mono text-[10px] text-muted">INV-2026-0118</p>
            {[
              ["Subtotal", "₹18,439.20"],
              ["CGST 9%", "₹1,659.53"],
              ["SGST 9%", "₹1,659.53"],
            ].map(([k, v]) => (
              <div key={k} className="mt-1.5 flex justify-between text-muted">
                <span>{k}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-black/[0.06] pt-2 font-medium">
              <span>Total</span>
              <span className="tabular-nums">₹21,758.26</span>
            </div>
          </div>
        </div>
      </BentoCard>

      <BentoCard pill="Plan changes" ask="Move Ostra Health from monthly to yearly" wash="wash-sky">
        <div className="relative grid w-full max-w-[460px] grid-cols-2 overflow-hidden rounded-[12px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_16px_32px_-16px_rgb(0_0_0/0.25)]">
          {[
            ["Before", "Monthly", "₹8,000", "per month"],
            ["After", "Yearly", "₹96,000", "per year, one invoice"],
          ].map(([tag, plan, price, note], i) => (
            <div key={tag} className={`p-5 ${i ? "bg-loop/[0.04]" : ""}`}>
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                {tag}
              </span>
              <p className="mt-4 font-mono text-[11px] text-muted">{plan}</p>
              <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{price}</p>
              <p className="mt-1 text-[12px] text-muted">{note}</p>
            </div>
          ))}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-px bg-black/10 after:absolute after:top-1/2 after:left-1/2 after:flex after:size-6 after:-translate-1/2 after:items-center after:justify-center after:rounded-full after:bg-white after:text-[10px] after:shadow after:content-['‹›']"
          />
        </div>
      </BentoCard>
    </div>
  );
}

/* --------------------------------------------------- Feature stack */

function StackCard({
  pill,
  caption,
  wash,
  children,
}: {
  pill: string;
  caption: string;
  wash: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-stone-line bg-stone p-4 sm:p-5">
      <MonoPill>{pill}</MonoPill>
      <p className="mt-3 text-[14px] text-ink/75">{caption}</p>
      <div
        className={`mt-4 flex min-h-[280px] items-center justify-center rounded-[12px] px-4 py-10 sm:px-10 ${wash} shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)]`}
      >
        {children}
      </div>
    </div>
  );
}

const STATES = ["Draft", "Quotation", "Confirmed", "Active", "Closed"];

const SUBS = [
  { id: "SUB-00042", name: "Northwind Studio", state: 3 },
  { id: "SUB-00044", name: "Fernbrook Cafe", state: 1 },
  { id: "SUB-00051", name: "Lumen Press", state: 2 },
  { id: "SUB-00012", name: "Old Mill Books", state: 4 },
];

export function FeatureStack() {
  return (
    <div className="mt-14 space-y-4">
      <StackCard
        pill="Lifecycle"
        caption="Every subscription moves from draft to closed. You always know where each one stands."
        wash="wash-sky"
      >
        <div className={`${card} w-full max-w-[640px] overflow-hidden`}>
          <div className="flex h-7 items-center gap-1.5 border-b border-black/[0.06] px-3" aria-hidden="true">
            <span className="size-2 rounded-full bg-[#ff5f57]" />
            <span className="size-2 rounded-full bg-[#febc2e]" />
            <span className="size-2 rounded-full bg-[#28c840]" />
          </div>
          <ul className="p-2 text-[13px]">
            {SUBS.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[8px] px-3 py-2.5 sm:grid-cols-[150px_1fr]"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="font-mono text-[11px] text-muted">{s.id}</p>
                </div>
                <div className="flex items-center gap-1" aria-label={`Status: ${STATES[s.state]}`}>
                  {STATES.map((st, i) => (
                    <span
                      key={st}
                      className={`hidden h-1.5 flex-1 rounded-full sm:block ${
                        i <= s.state ? (s.state === 4 ? "bg-black/30" : "bg-loop") : "bg-black/[0.07]"
                      }`}
                    />
                  ))}
                  <span className="ml-2 w-[72px] text-right text-[12px] text-muted">{STATES[s.state]}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </StackCard>

      <StackCard
        pill="One invoice per cycle"
        caption="Run billing twice by mistake and nothing doubles. Each cycle gets exactly one invoice."
        wash="wash-dusk"
      >
        <div className={`${card} w-full max-w-[520px] p-5 font-mono text-[12px] leading-[1.9]`}>
          <p className="text-muted">Billing run · 1 Nov 2026, 09:00</p>
          <p>
            <span className="text-emerald-600">✓</span> 16 invoices generated
          </p>
          <p className="mt-3 text-muted">Billing run · 1 Nov 2026, 09:04</p>
          <p>
            <span className="text-emerald-600">✓</span> 0 invoices generated
          </p>
          <p className="text-muted">↳ 16 skipped, already invoiced this cycle</p>
        </div>
      </StackCard>

      <StackCard
        pill="Access by role"
        caption="Admins, staff and customers each see their own part. Only admins can create staff accounts."
        wash="wash-meadow"
      >
        <div className="grid w-full max-w-[720px] gap-3 sm:grid-cols-3">
          {[
            ["Admin", "Products, plans, taxes, discounts, staff and reports"],
            ["Staff", "Customers, quotations, subscriptions, invoices and payments"],
            ["Customer", "Their own subscriptions, invoices and profile"],
          ].map(([role, sees]) => (
            <div key={role} className={`${card} p-4`}>
              <p className="font-mono text-[11px] text-muted">{role}</p>
              <p className="mt-2 text-[14px] leading-snug">{sees}</p>
            </div>
          ))}
        </div>
      </StackCard>

      <StackCard
        pill="Plan rules"
        caption="Pause, renew or close early only when the plan allows it. Expired subscriptions can close on their own."
        wash="wash-lavender"
      >
        <div className={`${card} w-full max-w-[420px] p-5`}>
          <p className="font-mono text-[11px] text-muted">SUB-00042 · Growth plan</p>
          <p className="mt-1 text-[18px] font-medium">Northwind Studio</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-[8px] bg-ink px-3 py-1.5 text-white">Renew</span>
            <span className="rounded-[8px] bg-black/[0.05] px-3 py-1.5">Pause</span>
            <span className="rounded-[8px] bg-black/[0.03] px-3 py-1.5 text-black/30 line-through">
              Close early
            </span>
          </div>
          <p className="mt-3 text-[12px] text-muted">Early closure is turned off for the Growth plan.</p>
        </div>
      </StackCard>
    </div>
  );
}
