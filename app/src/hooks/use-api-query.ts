// Written with the help of Claude
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiResult } from '@/api/public-client';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

// Loads again whenever `key` changes or `reload` is called, and not at all while `key` is null; `setData` puts in what
// an action returned.
export function useApiQuery<T>(key: string | null, load: () => Promise<ApiResult<T>>) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [state, setState] = useState<{ key: string; attempt: number; data?: T; failure?: Failure }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    void loadRef.current().then((result) => {
      if (cancelled) return;
      setState(result.ok ? { key, attempt, data: result.data } : { key, attempt, failure: result });
    });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const setData = useCallback((data: T) => key !== null && setState({ key, attempt, data }), [key, attempt]);
  // A reload keeps the data it replaces until the new data arrives; a new key does not.
  const current = state?.key === key ? state : undefined;
  return {
    data: current?.data,
    failure: current?.attempt === attempt ? current.failure : undefined,
    loading: key !== null && current?.attempt !== attempt,
    reload,
    setData,
  };
}
