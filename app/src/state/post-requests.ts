// Written with the help of Claude
// AI Usage: "Хочу піти" requests on the Оголошення posts, kept in memory for the mock screens; reviewed by Daryna
// Halytska.
import { createStore } from '@/state/store';

// Posts the user asked to join, and the latest one, whose author the Т3.2 snackbar names.
const store = createStore<{ postIds: string[]; lastPostId?: string }>({ postIds: [] });

export const usePostRequests = store.use;

export function requestPost(postId: string) {
  store.set(({ postIds }) => ({
    postIds: postIds.includes(postId) ? postIds : [...postIds, postId],
    lastPostId: postId,
  }));
}
