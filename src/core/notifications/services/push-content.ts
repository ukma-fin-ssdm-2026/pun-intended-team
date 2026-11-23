// Written with the help of Claude
import type { Notification, NotificationType } from '../types/notification.ts';
import type { PushMessage } from '../types/push.ts';

// One line each, in Ukrainian, as the app speaks. Types whose senders are not built yet get the general line.
const bodies: Partial<Record<NotificationType, (notification: Notification) => string>> = {
  no_match_found: () => 'Цього разу компанії не знайшлося. Обери іншу подію або створи оголошення.',
  report_received: () => 'Ми отримали вашу скаргу й розглянемо її.',
};

const GENERAL_BODY = 'У вас нове сповіщення в Nearby.';

/** The push of a notification, for every device of the account; the app opens the notification from `data`. */
export function pushContent(notification: Notification): Omit<PushMessage, 'to'> {
  const body = bodies[notification.type]?.(notification) ?? GENERAL_BODY;
  return { body, data: { notificationId: notification.id, type: notification.type } };
}
