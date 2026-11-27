// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  acceptListingRequest,
  declineListingRequest,
  getListingRequest,
  type ListingRequest,
} from '@/api/listing-requests';
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
// The real client signs requests through the session, which needs the device's push and secure storage.
jest.mock('@/api/client', () => ({ apiClient: {} }));
jest.mock('@/api/listing-requests', () => ({
  getListingRequest: jest.fn(),
  acceptListingRequest: jest.fn(),
  declineListingRequest: jest.fn(),
}));
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

function aListingRequest(overrides: Partial<ListingRequest> = {}): ListingRequest {
  const person = {
    username: 'taras_m',
    displayName: 'Тарас',
    description: '',
    occupation: '',
    age: 25,
    interests: [
      { id: 'i1', name: 'Кіно', group: 'Мистецтво' },
      { id: 'i2', name: 'Джаз', group: 'Музика' },
    ],
    photo: null,
    cover: null,
  };
  return {
    id: 'r1',
    status: 'pending',
    role: 'author',
    createdAt: '2026-11-16T10:00:00.000Z',
    decidedAt: null,
    listing: { id: 'l1', title: 'Шукаю компанію на виставку', date: '2026-11-29', place: null, eventId: null },
    requester: person,
    author: { ...person, username: 'olena_k', displayName: 'Олена' },
    ...overrides,
  };
}

const requestNotification = aNotification({
  type: 'listing_request',
  payload: { listingRequestId: 'r1', listingId: 'l1', displayName: 'Тарас' },
});

const loaded = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

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

  describe('listing requests', () => {
    async function openRequestSheet(request = aListingRequest()) {
      jest.mocked(getListingRequest).mockReturnValue(loaded(request));
      setNotificationsState({ status: 'loaded', notifications: [requestNotification] });
      await render(<NotificationsScreen />);
      await fireEvent.press(screen.getByText('Тарас хоче піти з тобою'));
    }

    test('opens Д4 with the requester and the post from the API', async () => {
      await openRequestSheet();

      expect(getListingRequest).toHaveBeenCalledWith('r1');
      expect(screen.getByText('Хоче піти з тобою')).toBeTruthy();
      expect(screen.getByText('Тарас, 25')).toBeTruthy();
      expect(screen.getByText('Кіно · Джаз')).toBeTruthy();
      expect(screen.getByText('Шукаю компанію на виставку')).toBeTruthy();
    });

    test('"Прийняти" accepts the request and opens 07 for it', async () => {
      jest.mocked(acceptListingRequest).mockReturnValue(loaded(aListingRequest({ status: 'accepted' })));
      await openRequestSheet();

      await fireEvent.press(screen.getByText('Прийняти'));

      expect(acceptListingRequest).toHaveBeenCalledWith('r1');
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/mutual', params: { request: 'r1' } });
    });

    test('"Не цього разу" declines the request and stays on Т5', async () => {
      jest.mocked(declineListingRequest).mockReturnValue(loaded(aListingRequest({ status: 'declined' })));
      await openRequestSheet();

      await fireEvent.press(screen.getByText('Не цього разу'));

      expect(declineListingRequest).toHaveBeenCalledWith('r1');
      expect(screen.getByText('Запит відхилено')).toBeTruthy();
      expect(screen.queryByText('Хоче піти з тобою')).toBeNull();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    test('shows a declined request without the buttons', async () => {
      await openRequestSheet(aListingRequest({ status: 'declined' }));

      expect(screen.getByText('Хоче піти з тобою')).toBeTruthy();
      expect(screen.queryByText('Прийняти')).toBeNull();
    });

    test('goes straight to 07 for a request already accepted', async () => {
      await openRequestSheet(aListingRequest({ status: 'accepted' }));

      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/mutual', params: { request: 'r1' } });
      expect(screen.queryByText('Хоче піти з тобою')).toBeNull();
    });

    test('opens 07 from an accepted notification', async () => {
      const accepted = aNotification({
        type: 'listing_request_accepted',
        payload: { listingRequestId: 'r1', listingId: 'l1', displayName: 'Олена' },
      });
      setNotificationsState({ status: 'loaded', notifications: [accepted] });
      await render(<NotificationsScreen />);

      await fireEvent.press(screen.getByText('Олена: запит прийнято'));

      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/mutual', params: { request: 'r1' } });
    });
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
