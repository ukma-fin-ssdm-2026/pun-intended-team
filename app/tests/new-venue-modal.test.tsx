// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createVenue, type Venue } from '@/api/venues';
import { NewVenueModal } from '@/components/organization/new-venue-modal';

jest.mock('@/api/venues', () => ({ createVenue: jest.fn() }));
// The map is native; the test moves its centre through `onMove`.
const MAP_POINT = { lat: 50.4555, lng: 30.4407 };
jest.mock('@/components/map/point-picker-map', () => ({
  PointPickerMap: ({ onMove }: { onMove: (point: { lat: number; lng: number }) => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable accessibilityRole="button" onPress={() => onMove(MAP_POINT)}>
        <Text>Посунути мапу</Text>
      </Pressable>
    );
  },
}));

const venue: Venue = {
  id: '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05',
  name: 'Кіностудія',
  address: 'просп. Перемоги, 44',
  location: MAP_POINT,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// FR-009
describe('NewVenueModal', () => {
  test('adds the venue at the point under the pin and hands it back', async () => {
    jest.mocked(createVenue).mockResolvedValue({ ok: true, data: venue });
    const onCreated = jest.fn();
    await render(<NewVenueModal visible onClose={() => {}} onCreated={onCreated} />);

    await fireEvent.changeText(screen.getByLabelText('Назва'), ' Кіностудія ');
    await fireEvent.changeText(screen.getByLabelText('Адреса'), 'просп. Перемоги, 44');
    await fireEvent.press(screen.getByRole('button', { name: 'Посунути мапу' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Додати місце' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(venue));
    expect(createVenue).toHaveBeenCalledWith({
      name: 'Кіностудія',
      address: 'просп. Перемоги, 44',
      location: MAP_POINT,
    });
  });

  test('asks for the name and address before sending', async () => {
    await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Додати місце' }));

    expect(screen.getByText('Додай назву')).toBeOnTheScreen();
    expect(screen.getByText('Додай адресу')).toBeOnTheScreen();
    expect(createVenue).not.toHaveBeenCalled();
  });

  test('says why the API refused a point outside Kyiv', async () => {
    jest.mocked(createVenue).mockResolvedValue({ ok: false, status: 422, code: 'VENUE_OUTSIDE_CITY' });
    await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);

    await fireEvent.changeText(screen.getByLabelText('Назва'), 'Кіностудія');
    await fireEvent.changeText(screen.getByLabelText('Адреса'), 'просп. Перемоги, 44');
    await fireEvent.press(screen.getByRole('button', { name: 'Додати місце' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/має бути в Києві/);
  });
});
