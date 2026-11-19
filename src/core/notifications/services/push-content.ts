// Written with the help of Claude
import type { Notification, NotificationPayload, NotificationType } from '../types/notification.ts';
import type { PushMessage } from '../types/push.ts';

type PushText = Pick<PushMessage, 'title' | 'body'>;

// In Ukrainian, as the app speaks. Types whose senders are not built yet get the general line.
const texts: Partial<Record<NotificationType, (notification: Notification) => PushText>> = {
  event_changed: ({ payload }) => eventChangedText(payload),
  report_received: () => ({ body: 'Ми отримали вашу скаргу й розглянемо її.' }),
};

const GENERAL_BODY = 'У вас нове сповіщення в Nearby.';

/** The push of a notification, for every device of the account; the app opens the notification from `data`. */
export function pushContent(notification: Notification): Omit<PushMessage, 'to'> {
  const text = texts[notification.type]?.(notification) ?? { body: GENERAL_BODY };
  return { ...text, data: { notificationId: notification.id, type: notification.type } };
}

/**
 * With "ти", as the app's inbox. By what the change did to the application (matching.md, rule 10): the event was
 * cancelled, every changed day moved to another time, or a day is gone; and whether a mutual match was cancelled or
 * kept.
 */
function eventChangedText(payload: NotificationPayload): PushText {
  const match = payload.match as { cancelled: boolean } | undefined;
  if (payload.change === 'cancelled') {
    return {
      title: 'Подію скасовано',
      body: match?.cancelled
        ? 'Подію з твоєї заявки скасовано, тож ваша зустріч не відбудеться.'
        : 'Подію з твоєї заявки скасовано.',
    };
  }
  if (match?.cancelled) {
    return {
      title: 'Метч скасовано',
      body: 'День, коли ви збиралися піти разом, скасовано. Зустрічі не буде :(',
    };
  }
  const sessions = (payload.sessions ?? []) as { to: string | null }[];
  if (sessions.every(({ to }) => to !== null)) {
    return {
      title: 'Час події змінився',
      body: match ? 'Перевір новий час події. Ваш метч у силі.' : 'Перевір новий час події.',
    };
  }
  return { title: 'Розклад події змінився', body: 'Один із днів твоєї заявки скасовано. Перевір заявку.' };
}
