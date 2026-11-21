// Written with the help of Claude
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

type Post = jest.Mock<(path: string, init?: unknown) => Promise<unknown>>;

// The real call() and apiClient; only the refresh and guest token requests, and fetch, are stand-ins.
jest.mock('@/api/public-client', () => ({
  ...jest.requireActual<typeof import('@/api/public-client')>('@/api/public-client'),
  publicClient: { POST: jest.fn() },
}));
jest.mock('@/api/push-token', () => ({ registerPushToken: jest.fn(() => Promise.resolve()) }));
jest.mock('@/state/session', () => ({ setSignedIn: jest.fn(), setRole: jest.fn() }));

const fetchMock = jest.fn<typeof fetch>();

// Each test loads the modules afresh, since the session keeps the signed-in account in module state.
async function signedIn() {
  const session = require('@/api/session') as typeof import('@/api/session');
  const { apiClient } = require('@/api/client') as typeof import('@/api/client');
  const { call, publicClient } = require('@/api/public-client') as typeof import('@/api/public-client');
  const { setSignedIn } = require('@/state/session') as { setSignedIn: jest.Mock };
  // An access token that is due for renewal, so the next request renews the session first.
  await session.startSession({ accessToken: 'access-1', tokenType: 'Bearer', refreshToken: 'refresh-1', expiresIn: 0 });
  setSignedIn.mockClear();
  return {
    post: publicClient.POST as unknown as Post,
    setSignedIn,
    listCategories: () => call(() => apiClient.GET('/api/v1/categories')),
  };
}

function answer(status: number, code: string) {
  return { error: { error: { code, message: 'A message' } }, response: { status } };
}

const renewed = {
  data: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 3600 },
  response: { status: 200 },
};

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    Response.json([], { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.useRealTimers();
});

// REL-12: a refresh the API answered with an error reaches the screen with that status, not as "no connection".
describe('a request whose session renewal fails', () => {
  const kept: { status: number; code: string }[] = [
    { status: 503, code: 'SERVICE_UNAVAILABLE' },
    { status: 500, code: 'INTERNAL_ERROR' },
    { status: 429, code: 'RATE_LIMITED' },
  ];

  for (const { status, code } of kept) {
    test(`reports a refresh answered ${status} with its status and code, and keeps the user signed in`, async () => {
      const { post, setSignedIn, listCategories } = await signedIn();
      post.mockResolvedValue(answer(status, code));

      await expect(listCategories()).resolves.toEqual({ ok: false, status, code });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(setSignedIn).not.toHaveBeenCalledWith(false);
    });
  }

  // A screen reads 409 as a conflict of its own request ("Ця пропозиція вже не діє"), which this is not.
  test('reports a refresh answered 409 after its retry as 503, and keeps the user signed in', async () => {
    const { post, setSignedIn, listCategories } = await signedIn();
    post.mockResolvedValue(answer(409, 'CONFLICT'));

    await expect(listCategories()).resolves.toEqual({ ok: false, status: 503 });
    expect(post).toHaveBeenCalledTimes(2);
    expect(setSignedIn).not.toHaveBeenCalledWith(false);
  });

  test('keeps the user signed in, so the next request renews again', async () => {
    const { post, listCategories } = await signedIn();
    post.mockResolvedValueOnce(answer(503, 'SERVICE_UNAVAILABLE')).mockResolvedValueOnce(renewed);

    await listCategories();
    await expect(listCategories()).resolves.toEqual({ ok: true, data: [] });

    expect(post.mock.calls.map(([, init]) => init)).toEqual([
      { body: { refreshToken: 'refresh-1' } },
      { body: { refreshToken: 'refresh-1' } },
    ]);
    expect((fetchMock.mock.calls[0]?.[0] as Request).headers.get('Authorization')).toBe('Bearer access-2');
  });

  test('signs the user out on 401', async () => {
    const { post, setSignedIn, listCategories } = await signedIn();
    post.mockImplementation(async (path) =>
      path === '/api/v1/auth/refresh'
        ? answer(401, 'UNAUTHENTICATED')
        : { data: { accessToken: 'guest-1', expiresIn: 3600 }, response: { status: 200 } },
    );

    await listCategories();

    expect(setSignedIn).toHaveBeenCalledWith(false);
    expect((fetchMock.mock.calls[0]?.[0] as Request).headers.get('Authorization')).toBe('Bearer guest-1');
  });

  test('reports status 0 when neither try of the refresh gets an answer', async () => {
    const { post, setSignedIn, listCategories } = await signedIn();
    post.mockRejectedValue(new TypeError('Network request failed'));

    const result = listCategories();
    await jest.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toEqual({ ok: false, status: 0 });
    expect(post).toHaveBeenCalledTimes(2);
    expect(setSignedIn).not.toHaveBeenCalledWith(false);
  });

  test('sends the request with the new token when the refresh succeeds', async () => {
    const { post, listCategories } = await signedIn();
    post.mockResolvedValue(renewed);

    await expect(listCategories()).resolves.toEqual({ ok: true, data: [] });
    expect((fetchMock.mock.calls[0]?.[0] as Request).headers.get('Authorization')).toBe('Bearer access-2');
  });
});
