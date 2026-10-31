/** Illustrative monthly revenue for the reports preview. Single series, so no legend. */
const MONTHS = [
  { m: "Nov", v: 4.1 },
  { m: "Dec", v: 4.4 },
  { m: "Jan", v: 4.3 },
  { m: "Feb", v: 4.9 },
  { m: "Mar", v: 5.2 },
  { m: "Apr", v: 5.0 },
  { m: "May", v: 5.6 },
  { m: "Jun", v: 6.1 },
  { m: "Jul", v: 6.0 },
  { m: "Aug", v: 6.6 },
  { m: "Sep", v: 7.1 },
  { m: "Oct", v: 7.6 },
];

const MAX = 8;

export function RevenueChart() {
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between font-mono text-[11px] text-muted">
        <span>Revenue by month, ₹ lakh</span>
        <span className="tabular-nums">Oct ₹7.6L</span>
      </figcaption>
      <div className="mt-5 flex h-36 items-end gap-[2px] border-b border-black/10 sm:gap-1.5">
        {MONTHS.map((d, i) => {
          const last = i === MONTHS.length - 1;
          return (
            <div
              key={d.m}
              tabIndex={0}
              aria-label={`${d.m}: ₹${d.v} lakh`}
              className="group relative flex h-full flex-1 items-end outline-none"
            >
              <div
                className={`w-full rounded-t-[4px] transition-colors duration-150 ${
                  last
                    ? "bg-loop"
                    : "bg-loop/20 group-hover:bg-loop/40 group-focus-visible:bg-loop/40"
                }`}
                style={{ height: `${(d.v / MAX) * 100}%` }}
              />
              <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-white tabular-nums opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {d.m} ₹{d.v}L
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px] sm:gap-1.5" aria-hidden="true">
        {MONTHS.map((d, i) => (
          <span
            key={d.m}
            className={`flex-1 text-center font-mono text-[10px] text-muted ${i % 2 ? "invisible sm:visible" : ""}`}
          >
            {d.m}
          </span>
        ))}
      </div>
    </figure>
  );
}
