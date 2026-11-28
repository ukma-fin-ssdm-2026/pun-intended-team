// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Post } from '@/components/announcements/post';
import { POST_PREVIEW_LENGTH, PostCard } from '@/components/announcements/post-card';

const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/hooks/use-event', () => ({ useEvent: () => ({ data: undefined }) }));
// The real client signs requests through the session, which needs the device's push and secure storage.
jest.mock('@/api/client', () => ({ apiClient: {} }));

function aPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'l1',
    initial: 'О',
    nameAge: 'Олена',
    author: { name: 'Олена', accusative: 'Олена', instrumental: 'Олена', username: 'olena_k' },
    meta: '· Виставки',
    text: '',
    going: false,
    own: false,
    hasPlace: false,
    likeCount: 0,
    liked: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PostCard', () => {
  test('"Хочу піти" hands the post to the screen, which sends the request', async () => {
    const onRequest = jest.fn((_post: Post) => Promise.resolve());
    await render(<PostCard post={aPost()} onReport={() => {}} onRequest={onRequest} />);

    await fireEvent.press(screen.getByText('Хочу піти'));

    expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
  });

  test('shows a pending request as sent and does not send it again', async () => {
    const onRequest = jest.fn((_post: Post) => Promise.resolve());
    const post = aPost({ myRequest: { id: 'r1', status: 'pending' } });
    await render(<PostCard post={post} onReport={() => {}} onRequest={onRequest} />);

    await fireEvent.press(screen.getByText('Запит надіслано'));

    expect(onRequest).not.toHaveBeenCalled();
  });

  // The author's decline stays private: the card reads as for a pending request.
  test('shows a declined request as sent too', async () => {
    const post = aPost({ myRequest: { id: 'r1', status: 'declined' } });
    await render(<PostCard post={post} onReport={() => {}} onRequest={() => Promise.resolve()} />);

    expect(screen.getByText('Запит надіслано')).toBeTruthy();
    expect(screen.queryByText('Хочу піти')).toBeNull();
  });

  test('opens 07 for an accepted request', async () => {
    const post = aPost({ myRequest: { id: 'r1', status: 'accepted' } });
    await render(<PostCard post={post} onReport={() => {}} onRequest={() => Promise.resolve()} />);

    await fireEvent.press(screen.getByText('Запит прийнято'));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/mutual', params: { request: 'r1' } });
  });

  test('shows the like count next to the heart and hands the post to the screen on a tap', async () => {
    const onLike = jest.fn();
    await render(<PostCard post={aPost({ likeCount: 3, liked: true })} onReport={() => {}} onLike={onLike} />);

    const heart = screen.getByRole('button', { name: 'Подобається' });
    expect(heart).toBeSelected();
    expect(screen.getByText('3')).toBeOnTheScreen();
    await fireEvent.press(heart);

    expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }));
  });

  test('shows no count while nobody likes the post', async () => {
    await render(<PostCard post={aPost({ likeCount: 0, liked: false })} onReport={() => {}} onLike={() => {}} />);

    expect(screen.getByRole('button', { name: 'Подобається' })).not.toBeSelected();
    expect(screen.queryByText('0')).toBeNull();
  });

  test('the place chip opens the place on a map', async () => {
    const chips = [{ icon: 'pin' as const, label: 'Мистецький Арсенал' }];
    await render(<PostCard post={aPost({ chips, hasPlace: true })} onReport={() => {}} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Показати місце на мапі' }));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/listing-place', params: { listing: 'l1' } });
  });

  test('offers no request on the own post', async () => {
    await render(<PostCard post={aPost({ own: true })} onReport={() => {}} onRequest={() => Promise.resolve()} />);

    expect(screen.queryByText('Хочу піти')).toBeNull();
    expect(screen.getByText('Твій допис')).toBeTruthy();
  });

  describe('long text', () => {
    const words = 'Шукаю компанію на виставку в Мистецькому Арсеналі, потім можна на каву. ';
    const long = `${words.repeat(4)}Останнє речення.`;

    test('cuts a text over the limit at the last word and opens the rest in place', async () => {
      expect(long.length).toBeGreaterThan(POST_PREVIEW_LENGTH);
      await render(<PostCard post={aPost({ text: long })} onReport={() => {}} />);

      expect(screen.queryByText(/Останнє речення/)).toBeNull();
      expect(screen.getByText(/… Читати далі$/)).toBeOnTheScreen();

      await fireEvent.press(screen.getByText('Читати далі'));

      expect(screen.getByText(/Останнє речення\.$/)).toBeOnTheScreen();
      expect(screen.queryByText('Читати далі')).toBeNull();
    });

    test('shows a text within the limit whole, without the link', async () => {
      await render(<PostCard post={aPost({ text: words.trim() })} onReport={() => {}} />);

      expect(screen.getByText(words.trim())).toBeOnTheScreen();
      expect(screen.queryByText('Читати далі')).toBeNull();
    });
  });
});
