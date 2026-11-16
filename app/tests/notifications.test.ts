// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { components } from '@/api/schema';

type Notification = components['schemas']['Notification'];
type Call = jest.Mock<(path: string, init?: unknown) => Promise<unknown>>;

// The real client signs requests through the session, which needs the device's secure storage.
jest.mock('@/api/client', () => ({ apiClient: { GET: jest.fn(), POST: jest.fn() } }));

// Each test loads the modules afresh, since the store keeps the inbox in module state.
function load() {
  const api = require('@/api/notifications') as typeof import('@/api/notifications');
  const state = require('@/state/notifications') as typeof import('@/state/notifications');
  const { apiClient } = require('@/api/client') as { apiClient: { GET: Call; POST: Call } };
  return { ...api, ...state, get: apiClient.GET, post: apiClient.POST };
}

function aNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'report_received',
    payload: {},
    readAt: null,
    createdAt: '2026-11-16T10:00:00.000Z',
    ...overrides,
  };
}

const READ_AT = '2026-11-16T10:05:00.000Z';

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const page = (items: Notification[]) => ok({ items, page: { limit: 20, offset: 0, hasMore: false } });

beforeEach(() => {
  jest.resetModules();
});

describe('loading the inbox', () => {
  test('loads the caller’s notifications, newest first as the API sends them', async () => {
    const { loadNotifications, notificationsState, get } = load();
    const newer = aNotification({ id: 'n2', createdAt: '2026-11-16T11:00:00.000Z' });
    const older = aNotification({ id: 'n1' });
    get.mockResolvedValueOnce(page([newer, older]));

    await loadNotifications();

    expect(get.mock.calls[0]?.[0]).toBe('/api/v1/me/notifications');
    expect(notificationsState()).toEqual({ status: 'loaded', notifications: [newer, older] });
  });

  test('shows an error when the inbox cannot be loaded', async () => {
    const { loadNotifications, notificationsState, get } = load();
    get.mockRejectedValueOnce(new TypeError('Network request failed'));

    await loadNotifications();

    expect(notificationsState().status).toBe('error');
  });

  test('forgets the inbox of the account that signed out', async () => {
    const { loadNotifications, clearNotifications, notificationsState, get } = load();
    get.mockResolvedValueOnce(page([aNotification()]));
    await loadNotifications();

    clearNotifications();

    expect(notificationsState()).toEqual({ status: 'idle' });
  });
});

describe('reading a notification', () => {
  test('marks it read with the time the API returns', async () => {
    const { markNotificationRead, setNotificationsState, notificationsState, post } = load();
    setNotificationsState({ status: 'loaded', notifications: [aNotification()] });
    post.mockResolvedValueOnce(ok(aNotification({ readAt: READ_AT })));

    await markNotificationRead('n1');

    expect(post.mock.calls[0]).toEqual(['/api/v1/notifications/{id}/read', { params: { path: { id: 'n1' } } }]);
    expect(notificationsState().notifications?.[0]?.readAt).toBe(READ_AT);
  });

  test('sends nothing for a notification already read', async () => {
    const { markNotificationRead, setNotificationsState, post } = load();
    setNotificationsState({ status: 'loaded', notifications: [aNotification({ readAt: READ_AT })] });

    await markNotificationRead('n1');

    expect(post).not.toHaveBeenCalled();
  });

  test('keeps it unread when the API does not answer', async () => {
    const { markNotificationRead, setNotificationsState, notificationsState, post } = load();
    setNotificationsState({ status: 'loaded', notifications: [aNotification()] });
    post.mockRejectedValueOnce(new TypeError('Network request failed'));

    await markNotificationRead('n1');

    expect(notificationsState().notifications?.[0]?.readAt).toBeNull();
  });

  test('reading all marks every unread notification read, one request each', async () => {
    const { markAllNotificationsRead, setNotificationsState, notificationsState, post } = load();
    setNotificationsState({
      status: 'loaded',
      notifications: [aNotification({ id: 'n3' }), aNotification({ id: 'n2', readAt: READ_AT }), aNotification()],
    });
    post.mockImplementation((_path, init) =>
      Promise.resolve(
        ok(aNotification({ id: (init as { params: { path: { id: string } } }).params.path.id, readAt: READ_AT })),
      ),
    );

    await markAllNotificationsRead();

    expect(post.mock.calls.map(([, init]) => init)).toEqual([
      { params: { path: { id: 'n3' } } },
      { params: { path: { id: 'n1' } } },
    ]);
    expect(notificationsState().notifications?.every(({ readAt }) => readAt !== null)).toBe(true);
  });
});

describe('unreadCount', () => {
  test('counts the notifications not read yet', () => {
    const { unreadCount } = load();

    expect(
      unreadCount([aNotification({ id: 'n3' }), aNotification({ id: 'n2', readAt: READ_AT }), aNotification()]),
    ).toBe(2);
  });
});

describe('notificationText', () => {
  // SAFE-003
  test('says that a report was received', () => {
    const { notificationText } = load();

    expect(notificationText(aNotification())).toEqual({
      title: 'Скаргу отримано',
      text: 'Дякуємо. Модератор розгляне її найближчим часом.',
    });
  });

  const types: Notification['type'][] = [
    'match_proposed',
    'match_mutual',
    'respond_soon',
    'not_a_match',
    'continue_matching',
    'removed_from_matching',
    'no_match_found',
    'event_reminder',
    'event_changed',
    'report_received',
  ];
  for (const type of types) {
    test(`gives ${type} a title and a line`, () => {
      const { notificationText } = load();

      const { title, text } = notificationText(aNotification({ type }));

      expect(title.length).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
    });
  }
});
