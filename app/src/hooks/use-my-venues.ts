// Written with the help of Claude
import { loadMyVenues } from '@/api/venues';
import { useApiQuery } from '@/hooks/use-api-query';

// The organization's own venues, the only ones it can publish an event at.
export function useMyVenues() {
  const { data, failure, loading, reload, setData } = useApiQuery('my-venues', loadMyVenues);
  return { data, loading, error: Boolean(failure), reload, setData };
}
