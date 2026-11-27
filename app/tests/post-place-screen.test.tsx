// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { describePlace } from '@/api/places';
import PostPlaceScreen from '@/app/post-place';
import { clearPickedPlace, pickedPlace } from '@/state/post-place';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ back: mockBack, replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/api/places', () => ({ describePlace: jest.fn() }));
// The native map cannot render in Jest; the test moves it by calling onMove.
let mockMove: (point: { lat: number; lng: number }) => void = () => {};
jest.mock('@/components/map/point-picker-map', () => ({
  PointPickerMap: ({ onMove }: { onMove: (point: { lat: number; lng: number }) => void }) => {
    mockMove = onMove;
    return null;
  },
}));
jest.mock('@/hooks/use-status-bar-style', () => ({ useStatusBarStyle: () => {} }));
jest.mock('@/state/session', () => ({ useSession: () => ({ isGuest: false }) }));

beforeEach(() => {
  jest.clearAllMocks();
  clearPickedPlace();
});

describe('PostPlaceScreen', () => {
  test('shows what is at the map centre and returns it to the editor', async () => {
    jest.mocked(describePlace).mockResolvedValue({
      ok: true,
      data: { name: 'Мистецький Арсенал', address: 'вулиця Лаврська, 10-12' },
    });
    await render(<PostPlaceScreen />);

    expect(await screen.findByText('Мистецький Арсенал', {}, { timeout: 2000 })).toBeOnTheScreen();
    expect(screen.getByText('вулиця Лаврська, 10-12')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Обрати місце' }));

    expect(pickedPlace()).toEqual({
      name: 'Мистецький Арсенал',
      address: 'вулиця Лаврська, 10-12',
      location: { lat: 50.4501, lng: 30.5234 },
    });
    expect(mockBack).toHaveBeenCalled();
  });

  test('looks up only the point the map rested on', async () => {
    jest.mocked(describePlace).mockResolvedValue({ ok: true, data: { name: 'Арсенал', address: '' } });
    await render(<PostPlaceScreen />);

    mockMove({ lat: 50.44, lng: 30.55 });
    mockMove({ lat: 50.43, lng: 30.56 });

    expect(await screen.findByText('Арсенал', {}, { timeout: 2000 })).toBeOnTheScreen();
    expect(describePlace).toHaveBeenCalledTimes(1);
    expect(describePlace).toHaveBeenCalledWith({ lat: 50.43, lng: 30.56 });
  });

  test('lets the user name the place when the lookup fails', async () => {
    jest.mocked(describePlace).mockResolvedValue({ ok: false, status: 503, code: 'PLACE_LOOKUP_UNAVAILABLE' });
    await render(<PostPlaceScreen />);

    const field = await screen.findByLabelText('Назва місця', {}, { timeout: 2000 });
    expect(screen.getByRole('button', { name: 'Обрати місце' })).toBeDisabled();
    await fireEvent.changeText(field, 'Лавка біля фонтану');
    await fireEvent.press(screen.getByRole('button', { name: 'Обрати місце' }));

    expect(pickedPlace()).toEqual({
      name: 'Лавка біля фонтану',
      address: '',
      location: { lat: 50.4501, lng: 30.5234 },
    });
  });
});
