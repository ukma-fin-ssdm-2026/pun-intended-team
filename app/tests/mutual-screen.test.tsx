// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';

import { getListingRequest, getListingRequestContacts, type ListingRequest } from '@/api/listing-requests';
import MutualMatchScreen from '@/app/mutual';

const mockRedirect = jest.fn((_props: { href: string }) => null);
const mockParams: { id?: string; request?: string } = {};
const mockRouter = {
  back: jest.fn(),
  canGoBack: () => true,
  push: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
};
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  useFocusEffect: () => {},
}));
// The real client signs requests through the session, which needs the device's push and secure storage.
jest.mock('@/api/client', () => ({ apiClient: {} }));
jest.mock('@/api/session', () => ({ currentAccessToken: jest.fn(() => Promise.resolve(undefined)) }));
jest.mock('@/api/listing-requests', () => ({
  getListingRequest: jest.fn(),
  getListingRequestContacts: jest.fn(),
}));
jest.mock('@/api/profile', () => ({ acknowledgeSafetyNotice: jest.fn() }));
jest.mock('@/hooks/use-event', () => ({ useEvent: () => ({ data: undefined }) }));
const mockProfile = { username: 'olena_k', displayName: 'Олена', photo: null, safetyNotice: 'not_acknowledged' };
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: mockProfile }),
  useProfileInitial: () => 'О',
}));
jest.mock('@/state/safety-notice', () => ({
  useSafetyNoticeSeen: () => ({ loaded: true, seen: false }),
  markSafetyNoticeSeen: jest.fn(),
}));

const person = {
  username: 'taras_m',
  displayName: 'Тарас',
  description: '',
  occupation: '',
  age: 25,
  interests: [],
  photo: null,
  cover: null,
};

const accepted: ListingRequest = {
  id: 'r1',
  status: 'accepted',
  role: 'author',
  createdAt: '2026-11-16T10:00:00.000Z',
  decidedAt: '2026-11-16T11:00:00.000Z',
  listing: { id: 'l1', title: 'Шукаю компанію на виставку', date: '2026-11-29', place: null, eventId: null },
  requester: person,
  author: { ...person, username: 'olena_k', displayName: 'Олена' },
};

beforeEach(() => {
  jest.clearAllMocks();
  delete mockParams.id;
  delete mockParams.request;
  mockProfile.safetyNotice = 'not_acknowledged';
  jest.mocked(getListingRequest).mockResolvedValue({ ok: true, data: accepted });
  jest.mocked(getListingRequestContacts).mockResolvedValue({
    ok: true,
    data: { phone: null, linkedAccounts: [{ network: 'telegram', username: 'taras_m', url: 'https://t.me/taras_m' }] },
  });
});

describe('MutualMatchScreen', () => {
  test('without a match id, returns to Метчі', async () => {
    await render(<MutualMatchScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({ href: '/matches' });
  });

  describe('for a listing request', () => {
    // SAFE-002
    test('shows the safety reminder and asks for no contacts before it is acknowledged', async () => {
      mockParams.request = 'r1';

      await render(<MutualMatchScreen />);

      expect(await screen.findByText('Зрозуміло')).toBeTruthy();
      expect(getListingRequest).toHaveBeenCalledWith('r1');
      expect(getListingRequestContacts).not.toHaveBeenCalled();
    });

    test("shows the requester's contacts to the author once the notice is acknowledged", async () => {
      mockParams.request = 'r1';
      mockProfile.safetyNotice = 'hidden';

      await render(<MutualMatchScreen />);

      expect(await screen.findByText('Це взаємно!')).toBeTruthy();
      expect(getListingRequestContacts).toHaveBeenCalledWith('r1');
      expect(screen.getByText('Шукаю компанію на виставку')).toBeTruthy();
      expect(screen.getByText('Контакти')).toBeTruthy();
      expect(screen.queryByText('Зрозуміло')).toBeNull();
    });

    test('leaves for a request that is not accepted', async () => {
      mockParams.request = 'r1';
      jest.mocked(getListingRequest).mockResolvedValue({ ok: true, data: { ...accepted, status: 'pending' } });

      await render(<MutualMatchScreen />);

      await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
      expect(getListingRequestContacts).not.toHaveBeenCalled();
    });
  });
});
