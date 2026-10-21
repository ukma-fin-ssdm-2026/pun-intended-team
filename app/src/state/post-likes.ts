// Written with the help of Claude
// AI Usage: shared post likes of the Оголошення tab, kept in memory for the mock screens; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

// Ids of the posts the user liked; every heart of a post reads and toggles the same entry.
const store = createStore<{ postIds: string[] }>({ postIds: [] });

export function useLiked(postId: string) {
  return store.use().postIds.includes(postId);
}

export function toggleLike(postId: string) {
  store.set(({ postIds }) => ({
    postIds: postIds.includes(postId) ? postIds.filter((id) => id !== postId) : [...postIds, postId],
  }));
}
