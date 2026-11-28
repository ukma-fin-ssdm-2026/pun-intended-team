// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { likeListing, unlikeListing, type Listing } from '@/api/listings';
import { listingToPost } from '@/components/announcements/listing-post';
import { useListingLikes } from '@/hooks/use-listing-likes';
import { openGuestDialog } from '@/state/session';

jest.mock('@/api/listings', () => ({ likeListing: jest.fn(), unlikeListing: jest.fn() }));
const mockSession = { isGuest: false };
jest.mock('@/state/session', () => ({ useSession: () => mockSession, openGuestDialog: jest.fn() }));

const aListing: Listing = {
  id: 'l1',
  author: { username: 'olena_k', displayName: 'Олена', photo: null },
  category: { id: 'c1', name: 'Виставки' },
  eventId: null,
  title: 'Шукаю компанію на виставку',
  description: '',
  date: '2026-11-28',
  status: 'active',
  photo: null,
  place: null,
  myRequest: null,
  likeCount: 2,
  liked: false,
};

// The feed as useApiQuery keeps it: each update applies to what the previous one left.
function makeFeed(listings: Listing[]) {
  const feed = {
    listings,
    updateData: jest.fn((update: (listings: Listing[]) => Listing[]) => {
      feed.listings = update(feed.listings);
    }),
    reload: jest.fn(),
  };
  return feed;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.isGuest = false;
});

describe('useListingLikes', () => {
  test('turns the heart at once and keeps the count the API answers', async () => {
    const answer = deferred<Awaited<ReturnType<typeof likeListing>>>();
    jest.mocked(likeListing).mockReturnValue(answer.promise);
    const feed = makeFeed([aListing]);
    const { result } = await renderHook(() => useListingLikes(feed, jest.fn()));

    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current(listingToPost(aListing));
    });

    expect(feed.listings[0]).toMatchObject({ liked: true, likeCount: 3 });
    expect(likeListing).toHaveBeenCalledWith('l1');
    await act(async () => {
      answer.resolve({ ok: true, data: { liked: true, likeCount: 5 } });
      await done;
    });
    expect(feed.listings[0]).toMatchObject({ liked: true, likeCount: 5 });
  });

  test('takes the like back on a liked post', async () => {
    jest.mocked(unlikeListing).mockResolvedValue({ ok: true, data: { liked: false, likeCount: 1 } });
    const liked = { ...aListing, liked: true };
    const feed = makeFeed([liked]);
    const { result } = await renderHook(() => useListingLikes(feed, jest.fn()));

    await act(() => result.current(listingToPost(liked)));

    expect(unlikeListing).toHaveBeenCalledWith('l1');
    expect(feed.listings[0]).toMatchObject({ liked: false, likeCount: 1 });
  });

  test('turns the heart back and shows the failure when the call fails', async () => {
    jest.mocked(likeListing).mockResolvedValue({ ok: false, status: 0 });
    const show = jest.fn();
    const feed = makeFeed([aListing]);
    const { result } = await renderHook(() => useListingLikes(feed, show));

    await act(() => result.current(listingToPost(aListing)));

    expect(feed.listings[0]).toMatchObject({ liked: false, likeCount: 2 });
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }));
  });

  test('reloads the feed when the post is gone', async () => {
    jest.mocked(likeListing).mockResolvedValue({ ok: false, status: 404, code: 'NOT_FOUND' });
    const show = jest.fn();
    const feed = makeFeed([aListing]);
    const { result } = await renderHook(() => useListingLikes(feed, show));

    await act(() => result.current(listingToPost(aListing)));

    expect(feed.reload).toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Допису вже немає' }));
  });

  test('ignores a second tap while the first call runs', async () => {
    const answer = deferred<Awaited<ReturnType<typeof likeListing>>>();
    jest.mocked(likeListing).mockReturnValue(answer.promise);
    const feed = makeFeed([aListing]);
    const { result } = await renderHook(() => useListingLikes(feed, jest.fn()));

    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current(listingToPost(aListing));
      void result.current(listingToPost(feed.listings[0]));
    });
    await act(async () => {
      answer.resolve({ ok: true, data: { liked: true, likeCount: 3 } });
      await done;
    });

    expect(likeListing).toHaveBeenCalledTimes(1);
    expect(unlikeListing).not.toHaveBeenCalled();
  });

  test('offers a guest to sign in instead of liking', async () => {
    mockSession.isGuest = true;
    const feed = makeFeed([aListing]);
    const { result } = await renderHook(() => useListingLikes(feed, jest.fn()));

    await act(() => result.current(listingToPost(aListing)));

    expect(openGuestDialog).toHaveBeenCalled();
    expect(likeListing).not.toHaveBeenCalled();
    expect(feed.updateData).not.toHaveBeenCalled();
  });
});
