import type { ReactNode } from "react";

export function inputClass(hasError = false): string {
  const state = hasError
    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
    : "border-black/10 focus:border-loop/60 focus:ring-loop/10";
  return [
    "block w-full rounded-[10px] border bg-white px-3 py-2 text-[14px] text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
    "placeholder:text-black/30 focus:ring-4 focus:outline-none",
    "disabled:cursor-not-allowed disabled:bg-stone",
    state,
  ].join(" ");
}

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

/** A labelled form control with an error message wired to aria-describedby. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[14px] font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  disabled,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 text-sm text-zinc-800">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}
