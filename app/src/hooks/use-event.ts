// Written with the help of Claude
import { apiClient } from '@/api/client';
import { call } from '@/api/public-client';
import { useApiQuery } from '@/hooks/use-api-query';

// Loads nothing while `id` is undefined.
export function useEvent(id: string | undefined) {
  const { data, failure, loading, reload } = useApiQuery(id ?? null, () =>
    call(() => apiClient.GET('/api/v1/events/{id}', { params: { path: { id: id ?? '' } } })),
  );
  const notFound = failure?.status === 404;
  let error: string | undefined;
  if (notFound) error = 'This event does not exist.';
  else if (failure) error = failure.status === 0 ? 'Could not reach the server.' : 'Could not load the event.';
  return { data, loading, error, notFound, reload };
}
