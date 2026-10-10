// Written with the help of Claude
import { useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

type Result = { categoryId: string | undefined; data?: Event[]; error?: string };

export function useEvents(categoryId?: string) {
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET('/api/v1/events', { params: { query: { categoryId } } })
      .then((response) => {
        if (cancelled) return;
        setResult(
          response.data ? { categoryId, data: response.data.items } : { categoryId, error: 'Could not load events.' },
        );
      })
      .catch(() => {
        if (!cancelled) setResult({ categoryId, error: 'Could not reach the server.' });
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const loading = result === undefined || result.categoryId !== categoryId;
  return { data: loading ? undefined : result.data, loading, error: loading ? undefined : result.error };
}
