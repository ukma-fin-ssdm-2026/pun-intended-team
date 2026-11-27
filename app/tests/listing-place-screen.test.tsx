// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { Listing } from '@/api/listings';
import ListingPlaceScreen from '@/app/listing-place';
import { mapsLink } from '@/components/map/maps-link';
import { useListing } from '@/hooks/use-listings';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ listing: 'l1' }),
}));
// The native map cannot render in Jest; the test reads the props it gets.
const mockMap = jest.fn();
jest.mock('@/components/map/point-picker-map', () => ({
  PointPickerMap: (props: unknown) => {
    mockMap(props);
    return null;
  },
}));
jest.mock('@/hooks/use-listings', () => ({ useListing: jest.fn() }));
jest.mock('@/hooks/use-status-bar-style', () => ({ useStatusBarStyle: () => {} }));
jest.mock('@/state/session', () => ({ useSession: () => ({ isGuest: false }) }));

const arsenal = {
  name: 'Мистецький Арсенал',
  address: 'вулиця Лаврська, 10-12',
  location: { lat: 50.4357, lng: 30.5555 },
};
const listing = { id: 'l1', place: arsenal } as Listing;

function loaded(overrides: Partial<ReturnType<typeof useListing>> = {}): ReturnType<typeof useListing> {
  return { data: listing, failure: undefined, loading: false, notFound: false, reload: jest.fn(), ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ListingPlaceScreen', () => {
  test('centres a still map on the place and names it in the card', async () => {
    jest.mocked(useListing).mockReturnValue(loaded());
    await render(<ListingPlaceScreen />);

    expect(useListing).toHaveBeenCalledWith('l1');
    expect(mockMap).toHaveBeenCalledWith(expect.objectContaining({ initial: arsenal.location, readOnly: true }));
    expect(screen.getByText('Мистецький Арсенал')).toBeOnTheScreen();
    expect(screen.getByText('вулиця Лаврська, 10-12')).toBeOnTheScreen();
  });

  test('"Відкрити в картах" opens the point in the system maps', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.mocked(useListing).mockReturnValue(loaded());
    await render(<ListingPlaceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Відкрити в картах' }));

    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('50.4357,30.5555'));
  });

  test('shows a spinner while the listing loads', async () => {
    jest.mocked(useListing).mockReturnValue(loaded({ data: undefined, loading: true }));
    await render(<ListingPlaceScreen />);

    expect(screen.getByLabelText('Завантажуємо місце')).toBeOnTheScreen();
  });

  test('says the place is not found for a removed listing, without a retry', async () => {
    jest
      .mocked(useListing)
      .mockReturnValue(
        loaded({ data: undefined, notFound: true, failure: { ok: false, status: 404, code: 'NOT_FOUND' } }),
      );
    await render(<ListingPlaceScreen />);

    expect(screen.getByText('Місце не знайдено')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull();
  });

  test('offers a retry when the listing cannot be loaded', async () => {
    const reload = jest.fn();
    jest.mocked(useListing).mockReturnValue(loaded({ data: undefined, failure: { ok: false, status: 0 }, reload }));
    await render(<ListingPlaceScreen />);

    expect(screen.getByText('Не вдалося завантажити місце')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(reload).toHaveBeenCalled();
  });

  test('the back button returns to the feed', async () => {
    jest.mocked(useListing).mockReturnValue(loaded());
    await render(<ListingPlaceScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Назад' }));

    expect(mockBack).toHaveBeenCalled();
  });
});

describe('mapsLink', () => {
  const point = { lat: 50.4357, lng: 30.5555 };

  test('opens Google Maps on Android and the web', () => {
    expect(mapsLink(point, 'android')).toBe('https://www.google.com/maps/search/?api=1&query=50.4357,30.5555');
    expect(mapsLink(point, 'web')).toBe('https://www.google.com/maps/search/?api=1&query=50.4357,30.5555');
  });

  test('opens Apple Maps on iOS', () => {
    expect(mapsLink(point, 'ios')).toBe('https://maps.apple.com/?q=50.4357,30.5555');
  });
});
