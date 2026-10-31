import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-black focus-visible:ring-ink/30",
  secondary:
    "bg-white text-ink shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04)] hover:bg-stone focus-visible:ring-loop/30",
  danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-300",
  ghost: "text-ink/70 hover:bg-black/[0.04] hover:text-ink focus-visible:ring-loop/30",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[13px]",
  md: "px-4 py-2 text-[14px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return [
    "press inline-flex items-center justify-center gap-2 rounded-[10px] font-medium",
    "focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANT[variant],
    SIZE[size],
  ].join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${buttonClass(variant, size)} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="4"
          />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" />
        </svg>
      )}
      {children}
    </button>
  );
}
