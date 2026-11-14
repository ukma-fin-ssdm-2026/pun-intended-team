// Written with the help of Claude
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { TRACK_PIN_VIEW_MS, VenueMap } from '@/components/map/venue-map';
import type { VenuePin } from '@/components/map/venue-map-props';

import { atlas } from './fixtures/events';

// The real map needs native code; here a marker is a view that keeps its props.
jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => <View>{children}</View>,
    Marker: ({ children, ...props }: { children: ReactNode }) => <View {...props}>{children}</View>,
  };
});

const pin = (count: number): VenuePin => ({ id: atlas.id, location: atlas.location, count, name: atlas.name });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// #448: on Android a marker that stops tracking its view too early, or keeps an old image, shows a wrong number.
describe('VenueMap', () => {
  test('tracks a pin view only for a moment after the pin is made', async () => {
    await render(<VenueMap pins={[pin(2)]} onPinPress={() => {}} />);
    expect(screen.getByLabelText('Атлас').props.tracksViewChanges).toBe(true);

    await act(() => jest.advanceTimersByTime(TRACK_PIN_VIEW_MS));

    expect(screen.getByLabelText('Атлас').props.tracksViewChanges).toBe(false);
  });

  test('makes the pin again when its number changes, so the new number is drawn', async () => {
    const { rerender } = await render(<VenueMap pins={[pin(2)]} onPinPress={() => {}} />);
    await act(() => jest.advanceTimersByTime(TRACK_PIN_VIEW_MS));

    await rerender(<VenueMap pins={[pin(3)]} onPinPress={() => {}} />);

    expect(screen.getByLabelText('Атлас')).toHaveTextContent('3');
    expect(screen.getByLabelText('Атлас').props.tracksViewChanges).toBe(true);
  });
});
