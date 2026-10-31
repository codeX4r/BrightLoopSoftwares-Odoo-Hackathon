"use client";

import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "@/lib/staff-api";

type State<T> = { key: string; data?: T; error?: string };

/**
 * Loads data for a page and reloads whenever `deps` change or `reload()` is called.
 * The previous data stays on screen while a reload is in flight, so filters don't flash.
 */
export function useApiData<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([deps, version]);
  const [state, setState] = useState<State<T>>({ key: "" });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ key, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({ key, data: prev.data, error: errorMessage(err) }));
      });
    return () => {
      cancelled = true;
    };
    // `key` captures every input; `load` is a new closure on each render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state.data,
    error: state.key === key ? state.error : undefined,
    loading: state.key !== key,
    reload,
  };
}
