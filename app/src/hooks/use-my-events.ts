// Written with the help of Claude
import { loadMyEvents } from '@/api/events';
import { useApiQuery } from '@/hooks/use-api-query';

export function useMyEvents() {
  const { data, failure, loading, reload, setData } = useApiQuery('my-events', loadMyEvents);
  return { data, loading, error: Boolean(failure), reload, setData };
}
