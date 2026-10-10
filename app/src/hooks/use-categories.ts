// Written with the help of Claude
import { useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

type Category = components['schemas']['Category'];

export function useCategories() {
  const [data, setData] = useState<Category[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET('/api/v1/categories')
      .then((response) => {
        if (cancelled) return;
        if (response.data) {
          setData(response.data.items);
        } else {
          setError('Could not load categories.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
