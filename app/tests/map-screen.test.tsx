// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import MapScreen from '@/app/(tabs)/map';
import type { VenueMapProps } from '@/components/map/venue-map-props';
import { useEvents, useVenueEvents } from '@/hooks/use-events';

import { anEvent, atlas } from './fixtures/events';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => {} }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  Accuracy: { Balanced: 3 },
}));
jest.mock('@/components/filters-sheet', () => ({ FiltersSheet: () => null }));
jest.mock('@/hooks/use-events', () => ({ useEvents: jest.fn(), useVenueEvents: jest.fn() }));
// The real map needs native code; this one draws a button per pin.
jest.mock('@/components/map/venue-map', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    VenueMap: ({ pins, onPinPress }: VenueMapProps) => (
      <View>
        {pins.map((pin) => (
          <Pressable
            key={pin.id}
            accessibilityRole="button"
            accessibilityLabel={pin.name}
            onPress={() => onPinPress(pin.id)}
          >
            <Text>{pin.count}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

const events = [anEvent('e1', 'Джаз-вечір'), anEvent('e2', 'Рок-концерт', atlas), anEvent('e3', 'Лекція про кіно')];

function eventsResult(overrides: Partial<ReturnType<typeof useEvents>> = {}): ReturnType<typeof useEvents> {
  return {
    data: events,
    loading: false,
    error: undefined,
    reload: jest.fn(),
    hasMore: false,
    loadMore: jest.fn(),
    loadingMore: false,
    loadMoreFailed: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useEvents).mockReturnValue(eventsResult());
  jest.mocked(useVenueEvents).mockImplementation((venueId) => ({
    data: venueId
      ? { items: events.filter((event) => event.venue.id === venueId), page: { limit: 20, offset: 0, hasMore: false } }
      : undefined,
    failure: undefined,
    loading: false,
    reload: jest.fn(),
    setData: () => {},
  }));
});

// FR-012, FR-013
describe('MapScreen', () => {
  test('shows one pin per venue with its number of events', async () => {
    await render(<MapScreen />);

    expect(screen.getByRole('button', { name: 'Мистецький Арсенал' })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Атлас' })).toHaveTextContent('1');
  });

  test('opens the venue card from a pin, and the event page from the card', async () => {
    await render(<MapScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Мистецький Арсенал' }));
    expect(screen.getByText('2 події')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /Лекція про кіно/ }));

    expect(useVenueEvents).toHaveBeenLastCalledWith('v1', expect.anything());
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/events/[id]', params: { id: 'e3' } });
  });

  test('narrows the pins with the search, by event title or venue name', async () => {
    await render(<MapScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Заклад або подія'), 'атлас');

    expect(screen.queryByRole('button', { name: 'Мистецький Арсенал' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Атлас' })).toBeOnTheScreen();
  });

  test('loads the next page of events while there is one, so every venue gets a pin', async () => {
    const loadMore = jest.fn();
    jest.mocked(useEvents).mockReturnValue(eventsResult({ hasMore: true, loadMore }));

    await render(<MapScreen />);

    expect(loadMore).toHaveBeenCalled();
  });

  test('offers a retry when the events cannot be loaded', async () => {
    const reload = jest.fn();
    jest.mocked(useEvents).mockReturnValue(eventsResult({ data: undefined, error: 'Could not load events.', reload }));
    await render(<MapScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(reload).toHaveBeenCalled();
  });
});
