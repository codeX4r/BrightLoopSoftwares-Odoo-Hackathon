"use client";

import { createContext, useContext, type ReactNode } from "react";

import { ToastStack, useToastQueue } from "@/components/ui/feedback";

type Notify = (message: string, tone?: "success" | "error") => void;

const ToastContext = createContext<Notify | null>(null);

/** Provides `notify(message, tone)` to every admin page. */
export function AdminToastProvider({ children }: { children: ReactNode }) {
  const { toasts, notify } = useToastQueue();
  return (
    <ToastContext value={notify}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext>
  );
}

export function useNotify(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useNotify must be used inside AdminToastProvider");
  return notify;
}
