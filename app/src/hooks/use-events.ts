// Written with the help of Claude
import { useCallback, useMemo, useRef, useState } from 'react';

import { apiClient } from '@/api/client';
import { call } from '@/api/public-client';
import type { components } from '@/api/schema';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

type Event = components['schemas']['Event'];
type EventsPage = components['schemas']['EventsPage'];

// The API's largest page; the catalog has no "list all" (catalog-access.md).
const PAGE_SIZE = 20;

// What the API narrows by. The search text, several categories and the districts are applied to the loaded pages only.
export type EventQuery = { categoryId?: string; from?: string; to?: string; venueId?: string };

const fetchPage = (query: EventQuery, offset: number) =>
  call(() => apiClient.GET('/api/v1/events', { params: { query: { ...query, limit: PAGE_SIZE, offset } } }));

// Pages after the first, valid only for the first page they were loaded after: a reload or another query drops them.
type More = { base: EventsPage; items: Event[]; hasMore: boolean; failed: boolean };

// FR-014: "Оновлено 10 лист 2026, 04:01" while the imported events are those of an earlier import run, which is when
// the API gives `lastUpdatedAt`; nothing while they are current.
export function lastUpdatedNotice(lastUpdatedAt: string | null | undefined): string | undefined {
  return lastUpdatedAt ? `Оновлено ${formatDateTime(lastUpdatedAt)}` : undefined;
}

// One page of the catalog; `loadMore` adds the next one, when the screen is scrolled to its end.
export function useEvents({ categoryId, from, to }: EventQuery = {}) {
  const first = useApiQuery(JSON.stringify([categoryId, from, to]), () => fetchPage({ categoryId, from, to }, 0));
  const [more, setMore] = useState<More>();
  const [loadingMore, setLoadingMore] = useState(false);
  const busy = useRef(false);

  const base = first.data;
  const extra = base && more?.base === base ? more : undefined;
  const data = useMemo(() => base && [...base.items, ...(extra?.items ?? [])], [base, extra]);
  const hasMore = extra ? extra.hasMore : (base?.page.hasMore ?? false);

  const loadMore = useCallback(() => {
    if (!base || !data || !hasMore || busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    const items = extra?.items ?? [];
    fetchPage({ categoryId, from, to }, data.length)
      .then((result) =>
        setMore(
          result.ok
            ? {
                base,
                items: [...items, ...result.data.items],
                hasMore: result.data.page.hasMore && result.data.items.length > 0,
                failed: false,
              }
            : { base, items, hasMore, failed: true },
        ),
      )
      // `call` turns a failed request into a result; this is for a body that is not a page of events.
      .catch(() => setMore({ base, items, hasMore, failed: true }))
      .finally(() => {
        busy.current = false;
        setLoadingMore(false);
      });
  }, [base, data, extra, hasMore, categoryId, from, to]);

  const error =
    first.failure && (first.failure.status === 0 ? 'Could not reach the server.' : 'Could not load events.');
  return {
    data,
    loading: first.loading,
    error,
    reload: first.reload,
    hasMore,
    loadMore,
    loadingMore,
    loadMoreFailed: extra?.failed ?? false,
    lastUpdated: lastUpdatedNotice(base?.lastUpdatedAt),
  };
}

// The first page of one venue's events, for the venue card of the map (FR-013); nothing while no venue is picked.
export function useVenueEvents(venueId: string | undefined, query: EventQuery) {
  const { categoryId, from, to } = query;
  return useApiQuery(venueId ? JSON.stringify([venueId, categoryId, from, to]) : null, () =>
    fetchPage({ categoryId, from, to, venueId }, 0),
  );
}

// The saved events: one request per id, since the catalog is not listed whole. An id the API does not return is left
// out; the caller falls back to what it has.
export function useEventsByIds(ids: string[]) {
  const key = ids.length > 0 ? ids.join(',') : null;
  return useApiQuery(key, async () => {
    const results = await Promise.all(
      ids.map((id) => call(() => apiClient.GET('/api/v1/events/{id}', { params: { path: { id } } }))),
    );
    return { ok: true as const, data: results.flatMap((result) => (result.ok ? [result.data] : [])) };
  });
}
