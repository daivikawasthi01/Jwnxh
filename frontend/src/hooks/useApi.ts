import { useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Runs `fn` whenever `deps` change; aborts stale requests. Keeps previous data while reloading. */
export function useApi<T>(fn: ((signal: AbortSignal) => Promise<T>) | null, deps: unknown[]): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: !!fn, error: null });

  useEffect(() => {
    if (!fn) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fn(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
