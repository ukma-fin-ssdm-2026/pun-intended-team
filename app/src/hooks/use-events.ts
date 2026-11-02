// Written with the help of Claude
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import { call } from '@/api/public-client';
import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

// The API's largest page.
const PAGE_SIZE = 20;

type Loaded = { data: Event[] } | { error: string };
type Result = Loaded & { categoryId: string | undefined; attempt: number };

// Every page of the catalog, since the screens search and filter it on the device.
async function loadAll(categoryId?: string): Promise<Loaded> {
  const events: Event[] = [];
  for (;;) {
    const result = await call(() =>
      apiClient.GET('/api/v1/events', {
        params: { query: { categoryId, limit: PAGE_SIZE, offset: events.length } },
      }),
    );
    if (!result.ok) {
      return { error: result.status === 0 ? 'Could not reach the server.' : 'Could not load events.' };
    }
    events.push(...result.data.items);
    if (!result.data.page.hasMore || result.data.items.length === 0) return { data: events };
  }
}

export function useEvents(categoryId?: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    let cancelled = false;
    // `call` turns a failed request into an error result; the catch is for a body that is not a page of events.
    loadAll(categoryId)
      .then((loaded) => {
        if (!cancelled) setResult({ ...loaded, categoryId, attempt });
      })
      .catch(() => {
        if (!cancelled) setResult({ error: 'Could not load events.', categoryId, attempt });
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const loading = result === undefined || result.categoryId !== categoryId || result.attempt !== attempt;
  return {
    data: loading || !('data' in result) ? undefined : result.data,
    loading,
    error: loading || !('error' in result) ? undefined : result.error,
    reload,
  };
}
