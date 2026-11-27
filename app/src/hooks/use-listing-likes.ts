// Written with the help of Claude
import { useCallback, useRef } from 'react';

import { likeListing, unlikeListing, type Listing, type ListingLikes } from '@/api/listings';
import { failureSnackbar } from '@/auth/messages';
import type { Post } from '@/components/announcements/post';
import type { SnackbarContent } from '@/components/ui/snackbar';
import { openGuestDialog, useSession } from '@/state/session';

type Feed = {
  updateData: (update: (listings: Listing[]) => Listing[]) => void;
  reload: () => void;
};

// The heart of a post card. It turns at once, then shows the count the API answers; a failed call turns it back and
// shows why. A second tap while the call runs is ignored, so the answers cannot arrive out of order.
export function useListingLikes(feed: Feed, show: (snackbar: SnackbarContent) => void) {
  const { isGuest } = useSession();
  const pending = useRef(new Set<string>());
  const { updateData, reload } = feed;

  return useCallback(
    async (post: Post) => {
      if (isGuest) {
        openGuestDialog();
        return;
      }
      if (pending.current.has(post.id)) return;
      pending.current.add(post.id);
      const set = (likes: ListingLikes) =>
        updateData((listings) =>
          listings.map((listing) => (listing.id === post.id ? { ...listing, ...likes } : listing)),
        );
      const { liked, likeCount } = post;
      set({ liked: !liked, likeCount: Math.max(0, likeCount + (liked ? -1 : 1)) });
      const result = await (liked ? unlikeListing(post.id) : likeListing(post.id));
      pending.current.delete(post.id);
      if (result.ok) {
        set(result.data);
        return;
      }
      set({ liked, likeCount });
      if (result.status === 404) {
        reload();
        show({ tone: 'error', title: 'Допису вже немає', note: 'Стрічку оновлено' });
      } else {
        show(failureSnackbar(result));
      }
    },
    [isGuest, updateData, reload, show],
  );
}
