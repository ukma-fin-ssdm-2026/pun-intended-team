// Written with the help of Claude
import { loadAllListings } from '@/api/listings';
import { useApiQuery } from '@/hooks/use-api-query';
import { useSession } from '@/state/session';

// The feed of listings. A guest's token gets a 401 here, so a guest loads nothing.
export function useListings() {
  const { signedIn, isGuest } = useSession();
  return useApiQuery(signedIn && !isGuest ? 'listings' : null, loadAllListings);
}
