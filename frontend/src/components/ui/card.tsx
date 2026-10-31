import type { ReactNode } from "react";

/** White panel with an optional title bar. Used by the admin, staff and customer screens. */
export function Card({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
