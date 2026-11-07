// Written with the help of Claude
import { apiClient } from '@/api/client';
import { call } from '@/api/public-client';
import { useApiQuery } from '@/hooks/use-api-query';

async function loadInterests() {
  const result = await call(() => apiClient.GET('/api/v1/interests'));
  return result.ok ? { ...result, data: result.data.items } : result;
}

export function useInterests() {
  const { data, failure, loading, reload } = useApiQuery('interests', loadInterests);
  return { data, loading, failed: !!failure, reload };
}
