// Written with the help of Claude
import { apiClient } from '@/api/client';
import { call } from '@/api/public-client';
import { useApiQuery } from '@/hooks/use-api-query';

async function loadCategories() {
  const result = await call(() => apiClient.GET('/api/v1/categories'));
  return result.ok ? { ...result, data: result.data.items } : result;
}

export function useCategories() {
  const { data, failure, loading, reload } = useApiQuery('categories', loadCategories);
  const error = failure && (failure.status === 0 ? 'Could not reach the server.' : 'Could not load categories.');
  return { data, loading, error, reload };
}
