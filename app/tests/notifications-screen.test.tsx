// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { loadNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications';
import type { components } from '@/api/schema';
import NotificationsScreen from '@/app/notifications';
import { setNotificationsState } from '@/state/notifications';

type Notification = components['schemas']['Notification'];

const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useFocusEffect: () => {},
}));
// The Т5.1 sheet shows mock posts with photos Jest cannot load; the inbox does not use it.
jest.mock('@/components/announcements/join-request-sheet', () => ({ JoinRequestSheet: () => null }));
jest.mock('@/api/notifications', () => ({
  loadNotifications: jest.fn(() => Promise.resolve()),
  markNotificationRead: jest.fn(() => Promise.resolve()),
  markAllNotificationsRead: jest.fn(() => Promise.resolve()),
}));

const READ_AT = '2026-11-16T10:05:00.000Z';

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NotificationsScreen', () => {
  test('loads the inbox when it opens', async () => {
    setNotificationsState({ status: 'idle' });

    await render(<NotificationsScreen />);

    expect(loadNotifications).toHaveBeenCalled();
  });

  // SAFE-003
  test('shows a notification from the API by its type', async () => {
    setNotificationsState({ status: 'loaded', notifications: [aNotification()] });

    await render(<NotificationsScreen />);

    expect(screen.getByText('Скаргу отримано')).toBeTruthy();
    expect(screen.getByText('Дякуємо. Модератор розгляне її найближчим часом.')).toBeTruthy();
  });

  test('marks only the unread notifications as unread', async () => {
    setNotificationsState({
      status: 'loaded',
      notifications: [aNotification({ id: 'n3' }), aNotification({ id: 'n2', readAt: READ_AT }), aNotification()],
    });

    await render(<NotificationsScreen />);

    expect(screen.getAllByLabelText('Непрочитане')).toHaveLength(2);
  });

  test('marks a notification read when it is opened', async () => {
    setNotificationsState({ status: 'loaded', notifications: [aNotification()] });
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByText('Скаргу отримано'));

    expect(markNotificationRead).toHaveBeenCalledWith('n1');
  });

  // FR-018
  test('opens the search screen of the event a "no match found" is about', async () => {
    const notification = aNotification({ type: 'no_match_found', payload: { applicationId: 'a1', eventId: 'e1' } });
    setNotificationsState({ status: 'loaded', notifications: [notification] });
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByText('Метч не знайшовся'));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/events/[id]/search', params: { id: 'e1' } });
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  test('opens the Метчі tab from a matching notification without an event', async () => {
    setNotificationsState({ status: 'loaded', notifications: [aNotification({ type: 'match_proposed' })] });
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByText('Новий метч'));

    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/matches');
  });

  test('reads every notification with "Прочитати все"', async () => {
    setNotificationsState({ status: 'loaded', notifications: [aNotification()] });
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Прочитати все' }));

    expect(markAllNotificationsRead).toHaveBeenCalled();
  });

  test('says so when there are no notifications yet', async () => {
    setNotificationsState({ status: 'loaded', notifications: [] });

    await render(<NotificationsScreen />);

    expect(screen.getByText('Сповіщень поки немає')).toBeTruthy();
  });

  test('says so when the inbox could not be loaded', async () => {
    setNotificationsState({ status: 'error' });

    await render(<NotificationsScreen />);

    expect(screen.getByText('Не вдалося завантажити сповіщення')).toBeTruthy();
  });
});
