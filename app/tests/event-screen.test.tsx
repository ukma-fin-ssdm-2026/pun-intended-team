// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import EventScreen from '@/app/events/[id]';
import { useEvent } from '@/hooks/use-event';

import { anEvent } from './fixtures/events';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'e1' }),
  useRouter: () => ({
    push: mockPush,
    navigate: mockNavigate,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    setParams: jest.fn(),
  }),
}));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BlurTargetView: View, BlurView: View };
});
// The bar's pulse needs reanimated's reduced-motion hook, which its Jest mock lacks.
jest.mock('@/components/matching/match-action-bar', () => ({ MatchActionBar: () => null, actionBarReach: () => 0 }));
jest.mock('@/hooks/use-event', () => ({ useEvent: jest.fn() }));
jest.mock('@/hooks/use-applications', () => ({
  useEventApplication: () => ({ application: undefined, reload: () => {} }),
}));
jest.mock('@/hooks/use-matches', () => ({ useApplicationMatch: () => ({ match: undefined }) }));
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: undefined, missing: false, reload: () => {} }),
}));
jest.mock('@/hooks/use-status-bar-style', () => ({ useStatusBarStyle: () => {} }));
jest.mock('@/state/session', () => ({ useSession: () => ({ isGuest: false }) }));
jest.mock('@/state/favorites', () => ({ useFavorite: () => false, toggleFavorite: () => {} }));

// Over the 105 characters of the preview, so it is cut at the last word before them.
const LONG_DESCRIPTION =
  'Вечір камерного джазу в залах Мистецького Арсеналу: квартет виконає авторські композиції та імпровізації ' +
  'на теми класичних стандартів.';

async function showEvent(overrides: Partial<ReturnType<typeof anEvent>> = {}) {
  jest.mocked(useEvent).mockReturnValue({
    data: { ...anEvent('e1', 'Джаз-вечір'), ...overrides },
    loading: false,
    error: undefined,
    notFound: false,
    reload: () => {},
  });
  await render(<EventScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EventScreen description', () => {
  test('a long description expands with "Читати далі" and collapses with "Читати менше"', async () => {
    await showEvent({ description: LONG_DESCRIPTION });

    await fireEvent.press(screen.getByText('Читати далі'));

    expect(screen.getByText(/на теми класичних стандартів/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Читати менше'));
    expect(screen.queryByText(/на теми класичних стандартів/)).toBeNull();
    expect(screen.getByText('Читати далі')).toBeTruthy();
  });

  test('a description that fits the preview has neither link', async () => {
    await showEvent({ description: 'Камерний джаз у Мистецькому Арсеналі.' });

    expect(screen.queryByText('Читати далі')).toBeNull();
    expect(screen.queryByText('Читати менше')).toBeNull();
  });
});

describe('EventScreen "На мапі"', () => {
  test('opens the map on the venue of the event, from the map block and the venue row', async () => {
    await showEvent();

    await fireEvent.press(screen.getByRole('button', { name: 'Показати на мапі' }));
    await fireEvent.press(screen.getByText('Мистецький Арсенал'));

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/map', params: { venueId: 'v1' } });
  });
});

describe('EventScreen "Організатор події"', () => {
  test('shows the organizer and opens its page', async () => {
    await showEvent({ source: 'organization', organizer: { id: 'o1', name: 'Подільський кіноклуб', logo: null } });

    await fireEvent.press(screen.getByText('Подільський кіноклуб'));

    expect(screen.getByText('Організатор події')).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/organizers/[id]', params: { id: 'o1' } });
  });

  test('is left out for an event without an organizer', async () => {
    await showEvent({ organizer: null });

    expect(screen.queryByText('Організатор події')).toBeNull();
  });
});

describe('EventScreen "Квитки та деталі"', () => {
  test('opens the provider page of an imported event', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const sourceUrl = 'https://artwizard.eu/events/jazz';
    await showEvent({ sourceUrl });

    await fireEvent.press(screen.getByRole('link', { name: 'Квитки та деталі' }));

    expect(openURL).toHaveBeenCalledWith(sourceUrl);
  });

  test('is hidden for an event without a provider page', async () => {
    await showEvent({ sourceUrl: null });

    expect(screen.queryByText('Квитки та деталі')).toBeNull();
  });
});

// "02.1 Назва і категорія" takes the height of its title, so a one-line title leaves no gap above "Про подію".
describe('EventScreen title block', () => {
  for (const title of ['Я — Мамай', 'Джаз-вечір у Мистецькому Арсеналі з квартетом і гостями з Варшави']) {
    test(`has no fixed height for "${title}"`, async () => {
      await showEvent({ title });

      const block = screen.getByRole('header', { name: title }).parent;
      const classes: string[] = block?.props.className?.split(' ') ?? [];
      expect(classes).toContain('gap-2.5');
      expect(classes.filter((name) => /^h-/.test(name))).toEqual([]);
      expect(block?.props.style?.height).toBeUndefined();
    });
  }

  test('shows the full title without a line limit', async () => {
    const title = 'Благодійний концерт хорової капели НаУКМА «Почайна» пам’яті героїв-могилянців';
    await showEvent({ title });

    expect(screen.getByRole('header', { name: title }).props.numberOfLines).toBeUndefined();
  });
});

// "1.3 Ціна" on the cover, the only place with the price: `priceLabel`, and no badge for an unknown price.
describe('EventScreen price', () => {
  test.each([
    { priceMin: 450, priceMax: null, label: '450 ₴' },
    { priceMin: 300, priceMax: 700, label: '300–700 ₴' },
    { priceMin: 0, priceMax: null, label: 'Безкоштовно' },
  ])('shows "$label" on the cover', async ({ priceMin, priceMax, label }) => {
    await showEvent({ priceMin, priceMax });

    expect(screen.getByText(label)).toBeTruthy();
  });

  test('shows no price for an unknown price', async () => {
    await showEvent({ priceMin: null, priceMax: null });

    expect(screen.queryByText(/₴|Безкоштовно/)).toBeNull();
  });
});
