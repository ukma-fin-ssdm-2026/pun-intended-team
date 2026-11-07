// Written with the help of Claude
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

type Post = jest.Mock<(path: string, init: unknown) => Promise<unknown>>;

// Each test loads the session module afresh, since it keeps the signed-in account in module state.
jest.mock('@/api/public-client', () => ({ publicClient: { POST: jest.fn() } }));

function load() {
  const session = require('@/api/session') as typeof import('@/api/session');
  const { publicClient } = require('@/api/public-client') as typeof import('@/api/public-client');
  return { ...session, post: publicClient.POST as unknown as Post };
}

const renewed = {
  data: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 3600 },
  response: { status: 200 },
};

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// REL-08: the API accepts a replaced refresh token for 60 s, so a refresh that got no answer is sent once more.
describe('renewing the session', () => {
  test('sends a refresh that got no answer once more and uses its tokens', async () => {
    const { startSession, currentAccessToken, post } = load();
    await startSession({ accessToken: 'access-1', tokenType: 'Bearer', refreshToken: 'refresh-1', expiresIn: 0 });
    post.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(renewed);

    const token = currentAccessToken();
    await jest.advanceTimersByTimeAsync(2000);

    await expect(token).resolves.toBe('access-2');
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls.map(([, init]) => init)).toEqual([
      { body: { refreshToken: 'refresh-1' } },
      { body: { refreshToken: 'refresh-1' } },
    ]);
  });

  test('stays signed in when the second try gets no answer either, and tries again on the next request', async () => {
    const { startSession, currentAccessToken, post } = load();
    await startSession({ accessToken: 'access-1', tokenType: 'Bearer', refreshToken: 'refresh-1', expiresIn: 0 });
    post.mockRejectedValue(new TypeError('Network request failed'));

    const token = currentAccessToken();
    const failed = expect(token).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(2000);
    await failed;
    expect(post).toHaveBeenCalledTimes(2);

    post.mockReset();
    post.mockResolvedValueOnce(renewed);
    await expect(currentAccessToken()).resolves.toBe('access-2');
    expect(post.mock.calls[0]?.[1]).toEqual({ body: { refreshToken: 'refresh-1' } });
  });

  test('does not send again a refresh the API answered', async () => {
    const { startSession, currentAccessToken, post } = load();
    await startSession({ accessToken: 'access-1', tokenType: 'Bearer', refreshToken: 'refresh-1', expiresIn: 0 });
    post.mockResolvedValueOnce({ error: { error: { code: 'SERVICE_UNAVAILABLE' } }, response: { status: 503 } });

    await expect(currentAccessToken()).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
