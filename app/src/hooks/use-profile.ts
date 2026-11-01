// Written with the help of Claude
import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

type Profile = components['schemas']['Profile'];

type Result = { data?: Profile; missing?: boolean; error?: string };

export function useProfile() {
  const [result, setResult] = useState<Result>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .GET('/api/v1/me/profile')
      .then((response) => {
        if (cancelled) return;
        if (response.data) {
          setResult({ data: response.data });
        } else if (response.response.status === 404) {
          setResult({ missing: true });
        } else {
          setResult({ error: 'Could not load the profile.' });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ error: 'Could not reach the server.' });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return {
    data: result?.data,
    missing: result?.missing ?? false,
    loading: result === undefined,
    error: result?.error,
    reload,
  };
}
