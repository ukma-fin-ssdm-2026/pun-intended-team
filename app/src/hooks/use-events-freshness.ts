// Written with the help of Claude
import { apiClient } from '@/api/client';
import { call } from '@/api/public-client';
import type { components } from '@/api/schema';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

type ProviderFreshness = components['schemas']['ProviderFreshness'];

// FR-014: "Оновлено 10 лист 2026, 04:01" while a provider's latest import run failed, with the oldest time any such
// provider's events are from. Nothing while every run succeeded, or when a failed provider never succeeded at all.
export function lastUpdatedNotice(providers: ProviderFreshness[]): string | undefined {
  const times = providers.flatMap(({ latestRunFailed, lastSucceededAt }) =>
    latestRunFailed && lastSucceededAt ? [lastSucceededAt] : [],
  );
  if (times.length === 0) return undefined;
  const oldest = times.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b), times[0]);
  return `Оновлено ${formatDateTime(oldest)}`;
}

async function loadFreshness() {
  const result = await call(() => apiClient.GET('/api/v1/events/freshness'));
  return result.ok ? { ...result, data: result.data.items } : result;
}

// The catalog's "last updated" notice; a request that fails shows no notice, the list itself still loads.
export function useLastUpdatedNotice(): string | undefined {
  const { data } = useApiQuery('events-freshness', loadFreshness);
  return data && lastUpdatedNotice(data);
}
