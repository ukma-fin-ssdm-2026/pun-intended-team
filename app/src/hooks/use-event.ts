// Written with the help of Claude
import { useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

type Result = { id: string; data?: Event; error?: string };

export function useEvent(id: string) {
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET('/api/v1/events/{id}', { params: { path: { id } } })
      .then((response) => {
        if (cancelled) return;
        if (response.data) {
          setResult({ id, data: response.data });
        } else if (response.response.status === 404) {
          setResult({ id, error: 'This event does not exist.' });
        } else {
          setResult({ id, error: 'Could not load the event.' });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ id, error: 'Could not reach the server.' });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loading = result === undefined || result.id !== id;
  return { data: loading ? undefined : result.data, loading, error: loading ? undefined : result.error };
}
