import type { ReactNode } from "react";

export function inputClass(hasError = false): string {
  const state = hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
    : "border-zinc-300 focus:border-indigo-500 focus:ring-indigo-200";
  return [
    "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm",
    "placeholder:text-zinc-400 focus:ring-2 focus:outline-none",
    "disabled:cursor-not-allowed disabled:bg-zinc-100",
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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-800">
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
