// Written with the help of Claude
import type { ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';

import { imageUrl } from '@/api/images';
import { currentAccessToken } from '@/api/session';

// The token the last picture was loaded with, so a screen opened later starts loading its pictures at once. A picture
// already cached is shown from the cache, whatever token comes with it.
let lastToken: string | undefined;

/**
 * A picture from the API, loaded with the access token: pictures are never public links (TM-14). An id always has the
 * same picture, so it is the cache key, whatever token loaded it.
 */
export function useImageSource(id: string | undefined): ImageSource | undefined {
  const [token, setToken] = useState(lastToken);

  useEffect(() => {
    if (!id) return;
    let current = true;
    currentAccessToken().then(
      (value) => {
        lastToken = value;
        if (current) setToken(value);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [id]);

  if (!id || !token) return undefined;
  return { uri: imageUrl(id), headers: { Authorization: `Bearer ${token}` }, cacheKey: `nearby-image-${id}` };
}
