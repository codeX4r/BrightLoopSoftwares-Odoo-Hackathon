"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type BadgeTone = "green" | "amber" | "red" | "zinc" | "indigo";

const TONE: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

export function Badge({ tone = "zinc", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center py-16 text-sm text-zinc-500"
      aria-live="polite"
    >
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5"
    >
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-sm text-zinc-600">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-zinc-900">
            {title}
          </h2>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">{message}</p>
    </Modal>
  );
}

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

/** Small notification list. Each toast disappears after a few seconds. */
export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-lg px-4 py-3 text-sm shadow-lg ${
            t.tone === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export type { Toast, Tone };

/** Keeps a list of toasts and removes each one after `ms`. */
export function useToastQueue(ms = 4000) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function notify(message: string, tone: Tone = "success") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, ms);
  }

  return { toasts, notify };
}
