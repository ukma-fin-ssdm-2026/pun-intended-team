// Written with the help of Claude
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { describePlace } from '@/api/places';
import { createVenue, type Venue } from '@/api/venues';
import { KYIV_CENTER } from '@/components/map/kyiv';
import { NewVenueModal } from '@/components/organization/new-venue-modal';
import { LOOKUP_DELAY_MS } from '@/hooks/use-place-lookup';

jest.mock('@/api/venues', () => ({ createVenue: jest.fn() }));
jest.mock('@/api/places', () => ({ describePlace: jest.fn() }));
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

const arsenal = { name: 'Мистецький Арсенал', address: 'вулиця Лаврська, 10-12' };
const studio = { name: 'Кіностудія Довженка', address: 'просп. Перемоги, 44' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(describePlace).mockResolvedValue({ ok: false, status: 404 });
});

afterEach(() => {
  jest.useRealTimers();
});

// The map has rested: the lookup is sent and its answer arrives.
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(LOOKUP_DELAY_MS);
  });
}

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

  describe('fills the fields from the map', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    test('fills the address and the name of the point the map opens on', async () => {
      jest.mocked(describePlace).mockResolvedValue({ ok: true, data: arsenal });
      await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);

      expect(screen.getByText('Шукаємо адресу…')).toBeOnTheScreen();
      await settle();

      expect(describePlace).toHaveBeenCalledWith(KYIV_CENTER);
      expect(screen.getByLabelText('Адреса')).toHaveDisplayValue(arsenal.address);
      expect(screen.getByLabelText('Назва')).toHaveDisplayValue(arsenal.name);
      expect(screen.getByText('Перетягни мапу, щоб мітка стояла на вході до місця')).toBeOnTheScreen();
    });

    test('fills the name only while it is empty', async () => {
      jest.mocked(describePlace).mockResolvedValueOnce({ ok: true, data: arsenal });
      jest.mocked(describePlace).mockResolvedValueOnce({ ok: true, data: studio });
      await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);
      await settle();

      await fireEvent.press(screen.getByRole('button', { name: 'Посунути мапу' }));
      await settle();

      expect(describePlace).toHaveBeenLastCalledWith(MAP_POINT);
      expect(screen.getByLabelText('Адреса')).toHaveDisplayValue(studio.address);
      expect(screen.getByLabelText('Назва')).toHaveDisplayValue(arsenal.name);
    });

    test('cuts what it fills to the API limits', async () => {
      jest.mocked(describePlace).mockResolvedValue({
        ok: true,
        data: { name: ` ${'н'.repeat(120)}`, address: `${'а'.repeat(250)} ` },
      });
      await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);
      await settle();

      expect(screen.getByLabelText('Назва')).toHaveDisplayValue('н'.repeat(100));
      expect(screen.getByLabelText('Адреса')).toHaveDisplayValue('а'.repeat(200));
    });

    test('never overwrites an address the user has typed', async () => {
      jest.mocked(describePlace).mockResolvedValue({ ok: true, data: studio });
      await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);

      await fireEvent.changeText(screen.getByLabelText('Адреса'), 'вул. Дегтярівська, 44');
      await settle();
      await fireEvent.press(screen.getByRole('button', { name: 'Посунути мапу' }));
      await settle();

      expect(describePlace).toHaveBeenLastCalledWith(MAP_POINT);
      expect(screen.getByLabelText('Адреса')).toHaveDisplayValue('вул. Дегтярівська, 44');
      expect(screen.getByLabelText('Назва')).toHaveDisplayValue(studio.name);
    });

    test('keeps a name the user has cleared empty', async () => {
      jest.mocked(describePlace).mockResolvedValueOnce({ ok: true, data: arsenal });
      jest.mocked(describePlace).mockResolvedValueOnce({ ok: true, data: studio });
      await render(<NewVenueModal visible onClose={() => {}} onCreated={() => {}} />);
      await settle();

      await fireEvent.changeText(screen.getByLabelText('Назва'), '');
      await fireEvent.press(screen.getByRole('button', { name: 'Посунути мапу' }));
      await settle();

      expect(screen.getByLabelText('Назва')).toHaveDisplayValue('');
      expect(screen.getByLabelText('Адреса')).toHaveDisplayValue(studio.address);
    });

    test.each([
      ['nothing is there', { ok: false, status: 404 } as const],
      ['the lookup is unavailable', { ok: false, status: 503, code: 'PLACE_LOOKUP_UNAVAILABLE' } as const],
    ])('leaves the fields to the user when %s', async (_case, answer) => {
      jest.mocked(describePlace).mockResolvedValue(answer);
      jest.mocked(createVenue).mockResolvedValue({ ok: true, data: venue });
      const onCreated = jest.fn();
      await render(<NewVenueModal visible onClose={() => {}} onCreated={onCreated} />);
      await settle();

      expect(screen.getByLabelText('Адреса')).toHaveDisplayValue('');
      expect(screen.getByText('Перетягни мапу, щоб мітка стояла на вході до місця')).toBeOnTheScreen();
      expect(screen.queryByRole('alert')).toBeNull();
      await fireEvent.changeText(screen.getByLabelText('Назва'), 'Кіностудія');
      await fireEvent.changeText(screen.getByLabelText('Адреса'), 'просп. Перемоги, 44');
      await fireEvent.press(screen.getByRole('button', { name: 'Додати місце' }));

      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(venue));
    });
  });
});
