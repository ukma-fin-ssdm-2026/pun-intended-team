// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

type Call = jest.Mock<(path: string, init?: unknown) => Promise<unknown>>;

const PROJECT_ID = 'd984b937-4b38-409b-9d01-f6a4bb7ac171';
const PUSH_TOKEN = 'ExponentPushToken[device-1]';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ type: 'expo', data: 'ExponentPushToken[device-1]' })),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'd984b937-4b38-409b-9d01-f6a4bb7ac171' } } } },
}));
// The real client signs requests through the session, which needs the device's secure storage.
jest.mock('@/api/client', () => ({ apiClient: { PUT: jest.fn(() => Promise.resolve({ response: { ok: true } })) } }));

// Each test loads the modules afresh, with the platform it sets.
function load(os: 'android' | 'ios' | 'web' = 'android') {
  const { Platform } = require('react-native') as typeof import('react-native');
  jest.replaceProperty(Platform, 'OS', os);
  const notifications = require('expo-notifications') as Record<string, jest.Mock>;
  const { apiClient } = require('@/api/client') as { apiClient: { PUT: Call } };
  const { registerPushToken } = require('@/api/push-token') as typeof import('@/api/push-token');
  return { registerPushToken, notifications, put: apiClient.PUT };
}

beforeEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('registerPushToken', () => {
  test('registers the Expo push token of this device with the API', async () => {
    const { registerPushToken, notifications, put } = load('android');

    await registerPushToken();

    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    expect(put.mock.calls).toEqual([
      ['/api/v1/me/push-token', { body: { pushToken: PUSH_TOKEN, platform: 'android' } }],
    ]);
  });

  test('sends ios as the platform of an iPhone', async () => {
    const { registerPushToken, put } = load('ios');

    await registerPushToken();

    expect(put.mock.calls[0]?.[1]).toEqual({ body: { pushToken: PUSH_TOKEN, platform: 'ios' } });
  });

  // Android 13 and later show the permission prompt only once the app has a notification channel.
  test('creates the Android channel before it asks for the permission', async () => {
    const { registerPushToken, notifications } = load('android');

    await registerPushToken();

    const [channelOrder] = notifications.setNotificationChannelAsync.mock.invocationCallOrder;
    const [askOrder] = notifications.requestPermissionsAsync.mock.invocationCallOrder;
    expect(channelOrder).toBeLessThan(askOrder ?? 0);
  });

  test('sends nothing when the user does not allow notifications', async () => {
    const { registerPushToken, notifications, put } = load('android');
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);

    await registerPushToken();

    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  // The web build shows the inbox without push.
  test('asks nothing and sends nothing on the web', async () => {
    const { registerPushToken, notifications, put } = load('web');

    await registerPushToken();

    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test('settles without an error when the device gets no token, so sign-in goes on', async () => {
    const { registerPushToken, notifications, put } = load('android');
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('FIS_AUTH_ERROR') as never);

    await expect(registerPushToken()).resolves.toBeUndefined();
    expect(put).not.toHaveBeenCalled();
  });

  test('settles without an error when the API does not answer', async () => {
    const { registerPushToken, put } = load('android');
    put.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(registerPushToken()).resolves.toBeUndefined();
  });
});

describe('registering after sign-in', () => {
  type Post = jest.Mock<(path: string, init?: unknown) => Promise<unknown>>;
  const tokens = { accessToken: 'access-1', tokenType: 'Bearer' as const, refreshToken: 'refresh-1', expiresIn: 3600 };

  function loadSession() {
    jest.doMock('@/api/public-client', () => ({ publicClient: { POST: jest.fn() } }));
    jest.doMock('@/api/push-token', () => ({ registerPushToken: jest.fn(() => Promise.resolve()) }));
    const session = require('@/api/session') as typeof import('@/api/session');
    const { registerPushToken } = require('@/api/push-token') as { registerPushToken: jest.Mock };
    const { publicClient } = require('@/api/public-client') as { publicClient: { POST: Post } };
    return { ...session, registerPushToken, post: publicClient.POST };
  }

  test('registers the device once the user signs in', async () => {
    const { startSession, registerPushToken } = loadSession();

    await startSession(tokens);

    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });

  test('does not register again when the session is only renewed', async () => {
    const { startSession, registerPushToken } = loadSession();
    await startSession(tokens);

    await startSession({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' }, true);

    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });

  test('registers the device when the app starts with a stored session, once though it renews', async () => {
    jest.doMock('expo-secure-store', () => ({
      getItemAsync: jest.fn(() => Promise.resolve('refresh-1')),
      setItemAsync: jest.fn(() => Promise.resolve()),
      deleteItemAsync: jest.fn(() => Promise.resolve()),
    }));
    const { restoreSession, registerPushToken, post } = loadSession();
    post.mockResolvedValue({ data: { ...tokens, accessToken: 'access-2' }, response: { ok: true, status: 200 } });

    await restoreSession();
    await new Promise((resolve) => setImmediate(resolve));

    expect(registerPushToken).toHaveBeenCalledTimes(1);
  });

  test('registers again after a sign-out and the next sign-in', async () => {
    const { startSession, signOut, registerPushToken, post } = loadSession();
    post.mockResolvedValue({ response: { ok: true, status: 204 } });
    await startSession(tokens);
    await signOut();

    await startSession(tokens);

    expect(registerPushToken).toHaveBeenCalledTimes(2);
  });
});
