import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:ring-indigo-300",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 focus-visible:ring-zinc-300",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-300",
  ghost: "text-zinc-700 hover:bg-zinc-100 focus-visible:ring-zinc-300",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition",
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
