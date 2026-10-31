import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { INVOICE_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/format";
import type { CustomerSummary, InvoiceStatus, SubscriptionStatus } from "@/lib/staff-api";

/** Shared input classes, matching the login form. */
export const inputClass =
  "block w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] placeholder:text-black/30 focus:border-loop/60 focus:ring-4 focus:ring-loop/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone aria-invalid:border-red-300";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-medium tracking-[-0.03em] text-ink sm:text-[32px]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-[640px] text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
};

const BUTTON_VARIANT = {
  primary: "bg-ink text-white hover:bg-black focus-visible:ring-ink/30",
  secondary:
    "bg-white text-ink shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04)] hover:bg-stone focus-visible:ring-loop/30",
  danger:
    "bg-white text-red-700 shadow-[0_0_0_1px_rgb(220_38_38/0.2)] hover:bg-red-50 focus-visible:ring-red-200",
};

export function Button({
  variant = "primary",
  busy = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={`press inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[14px] font-medium focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_VARIANT[variant]} ${className}`}
      {...props}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={`press inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[14px] font-medium focus-visible:ring-2 focus-visible:outline-none ${BUTTON_VARIANT[variant]}`}
    >
      {children}
    </Link>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[16px] border border-transparent bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.03)] ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          {title && <h2 className="text-[15px] font-medium text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-loop/15 bg-loop/[0.05] text-ink",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[12px] border px-4 py-3 text-[14px] leading-snug ${styles}`}
    >
      {children}
    </div>
  );
}

const SUBSCRIPTION_BADGE: Record<SubscriptionStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  QUOTATION: "bg-amber-50 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-sky-50 text-sky-800 ring-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

const INVOICE_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  CONFIRMED: "bg-sky-50 text-sky-800 ring-sky-200",
  PAID: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-zinc-100 text-zinc-500 ring-zinc-200 line-through",
};

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge className={SUBSCRIPTION_BADGE[status]}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>;
}

export function InvoiceStatusBadge({
  status,
  overdue = false,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
}) {
  if (overdue) {
    return <Badge className="bg-red-50 text-red-700 ring-red-200">Overdue</Badge>;
  }
  return <Badge className={INVOICE_BADGE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[14px] font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
      )}
    </div>
  );
}

export function TableShell({
  head,
  children,
  empty,
  isEmpty,
}: {
  head: ReactNode;
  children: ReactNode;
  empty: ReactNode;
  isEmpty: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-transparent bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.03)]">
      <table className="min-w-full divide-y divide-black/[0.06] text-[14px]">
        <thead className="bg-stone/50 text-left font-mono text-[11px] font-normal text-muted">
          {head}
        </thead>
        <tbody className="divide-y divide-black/[0.05]">
          {isEmpty ? (
            <tr>
              <td colSpan={20} className="px-4 py-12 text-center text-zinc-500">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
      <p>
        {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function LoadingRow() {
  return (
    <p className="py-10 text-center text-sm text-zinc-500" aria-live="polite">
      Loading…
    </p>
  );
}

/** Customer name and company, with the email underneath (or alone if no profile yet). */
export function CustomerCell({ customer, href }: { customer: CustomerSummary; href?: string }) {
  const named = Boolean(customer.full_name || customer.company_name);
  const main = named ? (
    <span className="font-medium text-zinc-900">
      {customer.full_name ?? customer.company_name}
      {customer.full_name && customer.company_name && (
        <span className="font-normal text-zinc-500"> · {customer.company_name}</span>
      )}
    </span>
  ) : (
    <span className="text-zinc-700">{customer.email}</span>
  );
  return (
    <span className="block">
      {href ? (
        <Link href={href} className="hover:text-loop">
          {main}
        </Link>
      ) : (
        main
      )}
      {named && <span className="block text-xs text-zinc-500">{customer.email}</span>}
    </span>
  );
}

/** Customer block for printed quotations and invoices. */
export function BillTo({ customer }: { customer: CustomerSummary }) {
  return (
    <div className="text-sm text-zinc-900">
      {customer.full_name && <p className="font-medium">{customer.full_name}</p>}
      {customer.company_name && <p>{customer.company_name}</p>}
      <p className="text-zinc-600">{customer.email}</p>
    </div>
  );
}

export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-[11px] text-muted">{label}</dt>
          <dd className="mt-1 text-sm text-zinc-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
