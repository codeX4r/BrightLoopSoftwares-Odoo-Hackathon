type Tone = "loop" | "ink" | "sky" | "dusk" | "meadow";

const FILL: Record<Tone, [string, string]> = {
  loop: ["#6d63f6", "#4338ca"],
  ink: ["#3a3a36", "#1f1f1c"],
  sky: ["#8fb6f2", "#4f7fd6"],
  dusk: ["#f2a98a", "#b46fbf"],
  meadow: ["#a6cf8a", "#4f8f5a"],
};

/** The Brightloop loop as a square app icon. Sized by its container. */
export function BrandMark({ tone = "loop", className = "" }: { tone?: Tone; className?: string }) {
  const [from, to] = FILL[tone];
  const id = `bm-${tone}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <path
        d="M10 16a6 6 0 0 1 10.2-4.3M22 16a6 6 0 0 1-10.2 4.3"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="20.6" cy="11.4" r="1.9" fill="#fbbf24" />
      <circle cx="11.4" cy="20.6" r="1.9" fill="white" />
    </svg>
  );
}

/** Mono pill label, as used above cards and in the FAQ. */
export function MonoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-white px-3 py-1 font-mono text-[13px] text-ink shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_1px_2px_rgb(0_0_0/0.04)]">
      {children}
    </span>
  );
}

/** Blue message bubble: what someone asked Brightloop to do. */
export function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block max-w-[340px] rounded-[18px] bg-bubble px-3.5 py-1.5 text-[14px] leading-snug text-white after:absolute after:right-[-4px] after:bottom-0 after:size-3 after:rounded-bl-[10px] after:bg-bubble after:[clip-path:polygon(0_0,100%_100%,0_100%)]">
      {children}
    </span>
  );
}
