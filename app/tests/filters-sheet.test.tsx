// Written with the help of Claude
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { FiltersSheet } from '@/components/filters-sheet';
import { locateUser, type LocateResult } from '@/location';
import { resetFilters } from '@/state/catalog-filters';

jest.mock('@/location', () => ({ locateUser: jest.fn() }));

const categories = [
  { id: 'c1', name: 'Концерти' },
  { id: 'c2', name: 'Виставки' },
];

async function turnOnNearMe(result: LocateResult) {
  jest.mocked(locateUser).mockResolvedValue(result);
  await render(<FiltersSheet visible onClose={() => {}} events={[]} categories={categories} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Поруч зі мною' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Дозволити' }));
}

const selected = (name: string) => screen.getByRole('button', { name }).props.accessibilityState?.selected;

describe('FiltersSheet', () => {
  afterEach(async () => {
    await act(resetFilters);
    jest.mocked(locateUser).mockReset();
  });

  test('picks several categories', async () => {
    await render(<FiltersSheet visible onClose={() => {}} events={[]} categories={categories} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Концерти' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Виставки' }));

    expect([selected('Концерти'), selected('Виставки')]).toEqual([true, true]);
  });

  test('asks for the location only after "Дозволити" and then offers the radius', async () => {
    await turnOnNearMe({ status: 'located', point: { lat: 50.45, lng: 30.524 } });

    expect(locateUser).toHaveBeenCalledTimes(1);
    expect(selected('Поруч зі мною')).toBe(true);
    expect(selected('До 3 км')).toBe(true);
  });

  test('explains a refused permission and keeps "Поруч зі мною" off', async () => {
    await turnOnNearMe({ status: 'denied' });

    expect(screen.getByText(/Без доступу до геолокації/)).toBeTruthy();
    expect(selected('Поруч зі мною')).toBe(false);
    expect(screen.queryByRole('button', { name: 'До 3 км' })).toBeNull();
  });

  test('never asks for the location when "Не зараз" is pressed', async () => {
    await render(<FiltersSheet visible onClose={() => {}} events={[]} categories={categories} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Поруч зі мною' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Не зараз' }));

    expect(locateUser).not.toHaveBeenCalled();
  });
});
