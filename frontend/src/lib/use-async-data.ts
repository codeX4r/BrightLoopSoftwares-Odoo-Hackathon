"use client";

import { useCallback, useEffect, useState } from "react";

import { errorText } from "@/lib/format";

type AsyncState<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * Loads data when the dependencies change and exposes reload() for refreshes after a save.
 * Late responses from an earlier request are ignored, so fast filter changes can't show
 * stale rows.
 */
export function useAsyncData<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (err: unknown) => {
        if (!cancelled) setState({ data: null, error: errorText(err), loading: false });
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated on every render; the caller's deps decide when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  return { ...state, reload };
}
