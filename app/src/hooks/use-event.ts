// Written with the help of Claude
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

type Result = { id: string; attempt: number; data?: Event; error?: string; notFound?: boolean };

export function useEvent(id: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET('/api/v1/events/{id}', { params: { path: { id } } })
      .then((response) => {
        if (cancelled) return;
        if (response.data) {
          setResult({ id, attempt, data: response.data });
        } else if (response.response.status === 404) {
          setResult({ id, attempt, error: 'This event does not exist.', notFound: true });
        } else {
          setResult({ id, attempt, error: 'Could not load the event.' });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ id, attempt, error: 'Could not reach the server.' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const loading = result === undefined || result.id !== id || result.attempt !== attempt;
  return {
    data: loading ? undefined : result.data,
    loading,
    error: loading ? undefined : result.error,
    notFound: !loading && !!result.notFound,
    reload,
  };
}
