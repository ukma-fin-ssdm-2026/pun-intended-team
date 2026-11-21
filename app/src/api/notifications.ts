// Written with the help of Claude
import {
  notificationsSession,
  notificationsState,
  putNotification,
  setNotificationsState,
  type Notification,
} from '@/state/notifications';

import { apiClient } from './client';
import { call } from './public-client';

let request: { session: number; done: Promise<void> } | undefined;

// The first page, newest first: one request at a time per session, however many screens ask. A loaded inbox stays
// while it is read again.
export function loadNotifications() {
  const from = notificationsSession();
  if (request?.session === from) return request.done;
  const done = (async () => {
    if (notificationsState().status !== 'loaded') setNotificationsState({ status: 'loading' }, from);
    const result = await call(() => apiClient.GET('/api/v1/me/notifications'));
    setNotificationsState(
      result.ok ? { status: 'loaded', notifications: result.data.items } : { status: 'error' },
      from,
    );
  })().finally(() => {
    if (request?.done === done) request = undefined;
  });
  request = { session: from, done };
  return done;
}

const findLoaded = (id: string): Notification | undefined =>
  notificationsState().notifications?.find((n) => n.id === id);

// Unread until the API says otherwise, so a read that did not reach it is sent again on the next tap.
export async function markNotificationRead(id: string) {
  if (findLoaded(id)?.readAt) return;
  const from = notificationsSession();
  const result = await call(() => apiClient.POST('/api/v1/notifications/{id}/read', { params: { path: { id } } }));
  if (result.ok) putNotification(result.data, from);
}

// The API has no read-all, so each unread notification is read on its own.
export async function markAllNotificationsRead() {
  const unread = notificationsState().notifications?.filter(({ readAt }) => readAt === null) ?? [];
  await Promise.all(unread.map(({ id }) => markNotificationRead(id)));
}
