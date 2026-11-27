// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Post } from '@/components/announcements/post';
import { PostCard } from '@/components/announcements/post-card';

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

  test('offers no request on the own post', async () => {
    await render(<PostCard post={aPost({ own: true })} onReport={() => {}} onRequest={() => Promise.resolve()} />);

    expect(screen.queryByText('Хочу піти')).toBeNull();
    expect(screen.getByText('Твій допис')).toBeTruthy();
  });
});
