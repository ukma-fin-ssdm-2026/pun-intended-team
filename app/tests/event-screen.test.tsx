// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import EventScreen from '@/app/events/[id]';
import { useEvent } from '@/hooks/use-event';

import { anEvent } from './fixtures/events';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'e1' }),
  useRouter: () => ({
    push: jest.fn(),
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
jest.mock('@/hooks/use-event', () => ({ useEvent: jest.fn() }));
jest.mock('@/hooks/use-applications', () => ({
  useEventApplication: () => ({ application: undefined, reload: () => {} }),
}));
jest.mock('@/hooks/use-matches', () => ({ useApplicationMatch: () => ({ match: undefined }) }));
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: undefined, missing: false, reload: () => {} }),
}));
jest.mock('@/mocks/events', () => ({ findMockEvent: () => undefined }));
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
