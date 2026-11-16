// Written with the help of Claude
import type { components } from '@/api/schema';
import { createStore } from '@/state/store';

export type Notification = components['schemas']['Notification'];

export type NotificationsState =
  | { status: 'idle' | 'loading' | 'error'; notifications?: undefined }
  | { status: 'loaded'; notifications: Notification[] };

const store = createStore<{ state: NotificationsState }>({ state: { status: 'idle' } });

// Counts sign-ins and sign-outs: a load or read of an earlier session is dropped.
let session = 0;

export const notificationsSession = () => session;

export const useNotificationsState = () => store.use().state;
export const notificationsState = () => store.get().state;

export function setNotificationsState(state: NotificationsState, from = session) {
  if (from === session) store.set({ state });
}

/** Puts the notification the API returned in place of the one with its id. */
export function putNotification(notification: Notification, from = session) {
  const current = notificationsState();
  if (from !== session || current.status !== 'loaded') return;
  setNotificationsState({
    status: 'loaded',
    notifications: current.notifications.map((item) => (item.id === notification.id ? notification : item)),
  });
}

export function clearNotifications() {
  session += 1;
  store.set({ state: { status: 'idle' } });
}

export function unreadCount(notifications: Notification[]): number {
  return notifications.filter(({ readAt }) => readAt === null).length;
}

// One line per type, as the push says it (push-content.ts on the server says only the general line for most types).
const texts: Record<Notification['type'], { title: string; text: string }> = {
  match_proposed: { title: 'Новий метч', text: 'Знайшли тобі компанію на подію.' },
  match_mutual: { title: 'Це взаємно!', text: 'Метч прийнято з обох боків. Контакти відкрито.' },
  respond_soon: { title: 'Час відповісти', text: 'Пропозиція скоро завершиться. Встигни відповісти.' },
  not_a_match: { title: 'Не цього разу', text: 'Пропозиція не склалася. Шукаємо далі.' },
  continue_matching: { title: 'Шукати далі?', text: 'Пропозиція лишилася без відповіді. Продовжити пошук?' },
  removed_from_matching: {
    title: 'Пошук зупинено',
    text: 'Дві пропозиції лишилися без відповіді. Заявку можна подати знову.',
  },
  no_match_found: { title: 'Метч не знайшовся', text: 'Цього разу компанії не знайшлося.' },
  event_reminder: { title: 'Нагадування', text: 'Скоро подія, на яку ти йдеш.' },
  event_changed: { title: 'Подію змінено', text: 'Перевір нові деталі події.' },
  report_received: { title: 'Скаргу отримано', text: 'Дякуємо. Модератор розгляне її найближчим часом.' },
};

export function notificationText({ type }: Notification): { title: string; text: string } {
  return texts[type];
}
