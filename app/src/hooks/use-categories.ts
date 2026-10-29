// Written with the help of Claude
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

type Category = components['schemas']['Category'];

type Result = { attempt: number; data?: Category[]; error?: string };

export function useCategories() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET('/api/v1/categories')
      .then((response) => {
        if (cancelled) return;
        setResult(
          response.data ? { attempt, data: response.data.items } : { attempt, error: 'Could not load categories.' },
        );
      })
      .catch(() => {
        if (!cancelled) setResult({ attempt, error: 'Could not reach the server.' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const loading = result === undefined || result.attempt !== attempt;
  return { data: loading ? undefined : result.data, loading, error: loading ? undefined : result.error, reload };
}
