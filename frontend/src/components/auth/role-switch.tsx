"use client";

import { MotionConfig, motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";

import type { Role } from "@/lib/auth";

const OPTIONS: { value: Role; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admin" },
];

/** Same spring as the landing page tabs, so the pill feels like one product. */
const PILL_SPRING = { type: "spring", duration: 0.5, bounce: 0.35 } as const;

/**
 * Segmented role picker. All three choices are visible at once, which is quicker to scan
 * than a dropdown and makes the "wrong role" mistake easy to spot.
 */
export function RoleSwitch({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  value: Role | "";
  onChange: (role: Role) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const pillId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = OPTIONS.findIndex((o) => o.value === value);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (Math.max(index, 0) + step + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next].value);
    refs.current[next]?.focus();
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="radiogroup"
        aria-labelledby="role-label"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        className={`grid grid-cols-3 rounded-[14px] bg-stone p-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)] ${
          invalid ? "ring-2 ring-red-200" : ""
        }`}
      >
        {OPTIONS.map((option, i) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (index === -1 && i === 0) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`relative rounded-[10px] py-2.5 text-[14px] font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-loop/40 focus-visible:outline-none disabled:cursor-not-allowed ${
                selected ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId={pillId}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.1)]"
                  transition={PILL_SPRING}
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </MotionConfig>
  );
}
