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

type Text = { title: string; text: string };

// One line per type, as the push says it (push-content.ts on the server says only the general line for most types).
const texts: Record<Exclude<Notification['type'], ListingRequestType>, Text> = {
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

type ListingRequestType = 'listing_request' | 'listing_request_accepted';

// Т5.1 names who asks, by the display name the payload carries; the API knows no grammatical gender for the verb.
function listingRequestText(type: ListingRequestType, name: string): Text {
  return type === 'listing_request'
    ? { title: `${name} хоче піти з тобою`, text: 'Переглянь запит на своє оголошення.' }
    : { title: `${name}: запит прийнято`, text: 'Контакти відкрито. Домовтеся про зустріч.' };
}

export function notificationText({ type, payload }: Notification): Text {
  if (type === 'listing_request' || type === 'listing_request_accepted') {
    return listingRequestText(type, typeof payload.displayName === 'string' ? payload.displayName : 'Хтось');
  }
  return texts[type];
}
