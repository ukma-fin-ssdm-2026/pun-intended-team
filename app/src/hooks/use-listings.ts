// Written with the help of Claude
import { getListing, loadAllListings } from '@/api/listings';
import { useApiQuery } from '@/hooks/use-api-query';
import { useSession } from '@/state/session';

// The feed of listings. A guest's token gets a 401 here, so a guest loads nothing.
export function useListings() {
  const { signedIn, isGuest } = useSession();
  return useApiQuery(signedIn && !isGuest ? 'listings' : null, loadAllListings);
}

// One listing, as the place screen shows it; nothing for a guest, as for the feed, and nothing while `id` is undefined.
export function useListing(id: string | undefined) {
  const { signedIn, isGuest } = useSession();
  const { data, failure, loading, reload } = useApiQuery(signedIn && !isGuest && id ? `listing:${id}` : null, () =>
    getListing(id ?? ''),
  );
  return { data, failure, loading, notFound: failure?.status === 404, reload };
}
