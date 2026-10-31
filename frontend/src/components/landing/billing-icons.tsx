import type { ReactNode } from "react";

/**
 * Illustrated app-icon tiles: a glossy gradient square with one friendly object on it.
 * Every object shares the same face so the set reads as one family.
 */

const INK = "#2a2a27";

function Face({
  x,
  y,
  s = 1,
  sleepy = false,
}: {
  x: number;
  y: number;
  s?: number;
  sleepy?: boolean;
}) {
  const ex = 4.6 * s;
  return (
    <g>
      {sleepy ? (
        <>
          <path
            d={`M${x - ex - 1.7 * s} ${y} q${1.7 * s} ${1.5 * s} ${3.4 * s} 0`}
            stroke={INK}
            strokeWidth={1.2 * s}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${x + ex - 1.7 * s} ${y} q${1.7 * s} ${1.5 * s} ${3.4 * s} 0`}
            stroke={INK}
            strokeWidth={1.2 * s}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={x - ex} cy={y} r={1.8 * s} fill={INK} />
          <circle cx={x + ex} cy={y} r={1.8 * s} fill={INK} />
          <circle cx={x - ex - 0.5 * s} cy={y - 0.6 * s} r={0.6 * s} fill="#fff" />
          <circle cx={x + ex - 0.5 * s} cy={y - 0.6 * s} r={0.6 * s} fill="#fff" />
        </>
      )}
      <path
        d={`M${x - 1.8 * s} ${y + 2.3 * s} q${1.8 * s} ${1.9 * s} ${3.6 * s} 0`}
        stroke={INK}
        strokeWidth={1.2 * s}
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx={x - ex - 2.3 * s} cy={y + 2.6 * s} rx={1.9 * s} ry={1.1 * s} fill="#ff7a9a" opacity=".5" />
      <ellipse cx={x + ex + 2.3 * s} cy={y + 2.6 * s} rx={1.9 * s} ry={1.1 * s} fill="#ff7a9a" opacity=".5" />
    </g>
  );
}

function Tile({ id, from, to, children }: { id: string; from: string; to: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${id}-gl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-bg)`} />
      <ellipse cx="32" cy="53" rx="15" ry="2.6" fill="#000" opacity=".12" />
      {children}
      <rect width="64" height="64" rx="15" fill={`url(#${id}-gl)`} />
      <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="#fff" strokeOpacity=".22" />
    </svg>
  );
}

const star = (x: number, y: number, r = 3) =>
  `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`;

const dome = (x: number, y: number) => `M${x - 9} ${y + 7}C${x - 9} ${y - 9} ${x + 9} ${y - 9} ${x + 9} ${y + 7}Z`;

export const BILLING_ICONS: Record<string, ReactNode> = {
  daily: (
    <Tile id="daily" from="#ffb36b" to="#ff7442">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={32 + Math.cos(a) * 15.5}
            y1={32 + Math.sin(a) * 15.5}
            x2={32 + Math.cos(a) * 19.5}
            y2={32 + Math.sin(a) * 19.5}
            stroke="#fff2b8"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="32" cy="32" r="12.5" fill="#ffd95e" />
      <Face x={32} y={32} />
    </Tile>
  ),
  weekly: (
    <Tile id="weekly" from="#4d4d58" to="#24242b">
      <rect x="15" y="17" width="34" height="32" rx="7" fill="#fff" />
      <rect x="15" y="17" width="34" height="11" rx="7" fill="#ff6b6b" />
      <rect x="15" y="23" width="34" height="5" fill="#ff6b6b" />
      <rect x="22" y="13" width="3.4" height="8" rx="1.7" fill="#e6e6e6" />
      <rect x="38.6" y="13" width="3.4" height="8" rx="1.7" fill="#e6e6e6" />
      <Face x={32} y={37.5} />
    </Tile>
  ),
  monthly: (
    <Tile id="monthly" from="#86b0ff" to="#4f6df5">
      <defs>
        <mask id="monthly-cut">
          <rect width="64" height="64" fill="#fff" />
          <circle cx="42" cy="24" r="12" fill="#000" />
        </mask>
      </defs>
      <circle cx="30" cy="33" r="15" fill="#ffe58f" mask="url(#monthly-cut)" />
      <Face x={25} y={37} s={0.9} />
      <path d={star(46, 41, 3.2)} fill="#fff" />
      <path d={star(50, 18, 2.4)} fill="#fff" opacity=".85" />
    </Tile>
  ),
  yearly: (
    <Tile id="yearly" from="#fffaf2" to="#f1e3cf">
      <ellipse cx="32" cy="49.5" rx="18" ry="3.2" fill="#fff" stroke="#eadcc6" />
      <rect x="17" y="30" width="30" height="19" rx="5" fill="#ff9eb5" />
      <path
        d="M17 36v-1a5 5 0 0 1 5-5h20a5 5 0 0 1 5 5v1q-2.5 4-5 0q-2.5 4-5 0q-2.5 4-5 0q-2.5 4-5 0q-2.5 4-5 0q-2.5 4-5 0Z"
        fill="#fff"
      />
      <rect x="30.5" y="20" width="3" height="10" rx="1.5" fill="#7aa7ff" />
      <ellipse cx="32" cy="16.5" rx="2" ry="3" fill="#ffb347" />
      <Face x={32} y={42} s={0.9} />
    </Tile>
  ),
  seat: (
    <Tile id="seat" from="#6fdccf" to="#25a093">
      <rect x="20" y="40" width="3.2" height="10" rx="1.6" fill="#fff6e6" />
      <rect x="40.8" y="40" width="3.2" height="10" rx="1.6" fill="#fff6e6" />
      <rect x="20" y="13" width="24" height="21" rx="7" fill="#fff6e6" />
      <rect x="16.5" y="33" width="31" height="8.5" rx="4.25" fill="#ffd9a6" />
      <Face x={32} y={23} s={0.95} />
    </Tile>
  ),
  variants: (
    <Tile id="variants" from="#ffffff" to="#ebebeb">
      <path d={dome(23, 33)} fill="#ff9eb5" />
      <path d={dome(41, 33)} fill="#ffd36b" />
      <path d={dome(32, 42)} fill="#7aa7ff" />
      <Face x={32} y={44} s={0.8} />
    </Tile>
  ),
  quotes: (
    <Tile id="quotes" from="#4d4d58" to="#1d1d22">
      <path d="M22 39l-3.5 10 11-7z" fill="#fff" />
      <rect x="12.5" y="15" width="39" height="27" rx="11" fill="#fff" />
      <Face x={32} y={28} />
    </Tile>
  ),
  invoices: (
    <Tile id="invoices" from="#55aaff" to="#1f6fe0">
      <path d="M18 12h28v35l-3.5 3-3.5-3-3.5 3-3.5-3-3.5 3-3.5-3-3.5 3-3.5-3Z" fill="#fff" />
      <rect x="23" y="35" width="18" height="2.2" rx="1.1" fill="#d6e5fb" />
      <rect x="23" y="40" width="11" height="2.2" rx="1.1" fill="#d6e5fb" />
      <Face x={32} y={23} />
    </Tile>
  ),
  percent: (
    <Tile id="percent" from="#ffffff" to="#ececec">
      <g transform="rotate(-14 32 32)">
        <path d="M19 21h19l10 11-10 11H19a4 4 0 0 1-4-4V25a4 4 0 0 1 4-4Z" fill="#ffd36b" />
        <circle cx="41.5" cy="32" r="2.2" fill="#fff" />
        <Face x={27} y={31} s={0.9} />
      </g>
      <path d="M43 24c4-6 9-6 11-3" stroke="#c9b48a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </Tile>
  ),
  fixed: (
    <Tile id="fixed" from="#3e3e3e" to="#151515">
      <circle cx="32" cy="34.5" r="15" fill="#d9952c" />
      <circle cx="32" cy="32" r="15" fill="#ffd25e" />
      <circle cx="32" cy="32" r="11.5" fill="none" stroke="#f2b63c" strokeWidth="1.6" />
      <Face x={32} y={32} />
      <path d={star(47, 16, 2.6)} fill="#fff" opacity=".9" />
    </Tile>
  ),
  taxes: (
    <Tile id="taxes" from="#8a90ff" to="#4c4fe0">
      <rect x="18" y="11" width="28" height="41" rx="7" fill="#fff" />
      <rect x="22" y="15" width="20" height="10.5" rx="3" fill="#e8ebff" />
      <text
        x="32"
        y="22.8"
        textAnchor="middle"
        fontSize="6.6"
        fontWeight="700"
        fill="#4c4fe0"
        fontFamily="system-ui, sans-serif"
      >
        18%
      </text>
      <Face x={32} y={32} s={0.8} />
      {[24, 32, 40].map((x) => (
        <g key={x}>
          <circle cx={x} cy="41.5" r="2.3" fill="#dfe2ff" />
          <circle cx={x} cy="47.5" r="2.3" fill={x === 40 ? "#ff9eb5" : "#dfe2ff"} />
        </g>
      ))}
    </Tile>
  ),
  quantity: (
    <Tile id="quantity" from="#a3d6ff" to="#5aa9f0">
      {[
        [14, 34],
        [33, 34],
        [23.5, 19],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="17" height="15" rx="3" fill="#e9bb8b" />
          <rect x={x + 7} y={y} width="3" height="6" fill="#f6d8b3" />
        </g>
      ))}
      <Face x={32} y={28.5} s={0.75} />
    </Tile>
  ),
  addons: (
    <Tile id="addons" from="#68cf95" to="#2f8f5a">
      <rect x="16" y="30" width="32" height="20" rx="4" fill="#ff7a8a" />
      <rect x="14" y="25" width="36" height="8" rx="3" fill="#ff9aa7" />
      <rect x="30" y="25" width="4" height="25" fill="#ffe27a" />
      <ellipse cx="27" cy="21.5" rx="5.5" ry="3.5" fill="#ffe27a" transform="rotate(-25 27 21.5)" />
      <ellipse cx="37" cy="21.5" rx="5.5" ry="3.5" fill="#ffe27a" transform="rotate(25 37 21.5)" />
      <circle cx="32" cy="24" r="2.4" fill="#ffd23f" />
      <Face x={32} y={40} s={0.85} />
    </Tile>
  ),
  pause: (
    <Tile id="pause" from="#f2edff" to="#d6c8ff">
      <circle cx="24" cy="37" r="8" fill="#fff" />
      <circle cx="34" cy="31" r="10.5" fill="#fff" />
      <circle cx="43" cy="38" r="7" fill="#fff" />
      <rect x="17" y="37" width="32" height="9" rx="4.5" fill="#fff" />
      <Face x={33} y={37} sleepy />
      <text x="45" y="21" fontSize="8" fontWeight="700" fill="#8b7ad8" fontFamily="system-ui, sans-serif">
        z
      </text>
      <text x="51" y="14" fontSize="6" fontWeight="700" fill="#8b7ad8" fontFamily="system-ui, sans-serif">
        z
      </text>
    </Tile>
  ),
  renew: (
    <Tile id="renew" from="#ffa184" to="#e0553b">
      <path d="M32 34v-9" stroke="#4fbf80" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="25.5" cy="23" rx="6.5" ry="3.6" fill="#7ddca6" transform="rotate(-30 25.5 23)" />
      <ellipse cx="38.5" cy="21" rx="6.5" ry="3.6" fill="#6fd39a" transform="rotate(30 38.5 21)" />
      <path d="M21 36h22l-3 14H24Z" fill="#fff3e6" />
      <rect x="19" y="32.5" width="26" height="5.5" rx="2.75" fill="#ffe0c4" />
      <Face x={32} y={43} s={0.8} />
    </Tile>
  ),
  terms: (
    <Tile id="terms" from="#3a3a3a" to="#111111">
      <path d="M22 17h20c0 8-7 10-7 15s7 7 7 15H22c0-8 7-10 7-15s-7-7-7-15Z" fill="#fff" opacity=".92" />
      <path d="M24.5 19.5h15q-3 6-7.5 8.5q-4.5-2.5-7.5-8.5Z" fill="#ffd36b" />
      <path d="M25 47q7-8 14 0Z" fill="#ffd36b" />
      <rect x="18.5" y="12.5" width="27" height="4.5" rx="2.25" fill="#e9bb8b" />
      <rect x="18.5" y="47" width="27" height="4.5" rx="2.25" fill="#e9bb8b" />
      <Face x={32} y={37} s={0.6} />
    </Tile>
  ),
  upi: (
    <Tile id="upi" from="#ffb08e" to="#e0603f">
      <rect x="20" y="10.5" width="24" height="43" rx="6" fill="#2a2a27" />
      <rect x="22.5" y="14" width="19" height="36" rx="4" fill="#fff" />
      <Face x={32} y={26} s={0.8} />
      <circle cx="32" cy="40" r="4.5" fill="#4fbf80" />
      <path d="m29.8 40 1.6 1.6 3-3.2" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Tile>
  ),
  card: (
    <Tile id="card" from="#bba5ff" to="#7c5cf0">
      <rect x="11" y="19" width="42" height="28" rx="5" fill="#fff" />
      <rect x="11" y="24.5" width="42" height="5" fill="#2a2a27" opacity=".85" />
      <rect x="16" y="34" width="8" height="6.5" rx="1.6" fill="#ffd36b" />
      <Face x={39} y={37.5} s={0.8} />
    </Tile>
  ),
  bank: (
    <Tile id="bank" from="#ffffff" to="#e8e8e8">
      <circle cx="32" cy="17" r="4" fill="#ffd25e" stroke="#e6a93a" />
      <rect x="22" y="42" width="4.5" height="8" rx="2.25" fill="#ff9eb5" />
      <rect x="35" y="42" width="4.5" height="8" rx="2.25" fill="#ff9eb5" />
      <path d="M21 29l2-7 6 4Z" fill="#ff9eb5" />
      <ellipse cx="31" cy="36" rx="16" ry="11.5" fill="#ffb3c6" />
      <rect x="27.5" y="25.6" width="9" height="2" rx="1" fill="#e5809b" />
      <ellipse cx="46" cy="36.5" rx="3.6" ry="4.2" fill="#ff9eb5" />
      <circle cx="45" cy="35.5" r=".8" fill="#c95b78" />
      <circle cx="47" cy="37.5" r=".8" fill="#c95b78" />
      <Face x={34} y={34} s={0.8} />
    </Tile>
  ),
  cash: (
    <Tile id="cash" from="#a9e4bb" to="#5bb578">
      <rect x="12" y="18" width="40" height="25" rx="4" fill="#d2f3d7" transform="rotate(-9 32 30)" />
      <rect x="10" y="21" width="44" height="26" rx="4" fill="#effcef" stroke="#7cc995" strokeWidth="1.5" />
      <circle cx="32" cy="34" r="8.5" fill="#c8f0cf" />
      <Face x={32} y={33.5} s={0.8} />
    </Tile>
  ),
  cheque: (
    <Tile id="cheque" from="#dccfff" to="#9d86f2">
      <rect x="12" y="19" width="40" height="29" rx="5" fill="#fff" />
      <path d="M13 22l19 13 19-13" stroke="#e3dcff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <Face x={32} y={41} s={0.8} />
      <circle cx="47" cy="17" r="4.5" fill="#ff6b6b" />
    </Tile>
  ),
};
