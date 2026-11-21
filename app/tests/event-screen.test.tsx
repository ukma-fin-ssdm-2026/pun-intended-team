// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import EventScreen from '@/app/events/[id]';

import { anEvent } from './fixtures/events';

const LONG_TITLE = 'Благодійний концерт хорової капели НаУКМА «Почайна» пам’яті героїв-могилянців';
const mockEvent = { ...anEvent('e1', LONG_TITLE), description: 'Концерт у Києво-Могилянській академії.' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'e1' }),
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }),
}));
// The API client registers for push notifications on import, which Jest cannot do.
jest.mock('@/api/push-token', () => ({ registerPushToken: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/ui/event-cover', () => ({ EventCover: () => null, coverOf: () => undefined }));
jest.mock('@/hooks/use-status-bar-style', () => ({ useStatusBarStyle: () => {} }));
jest.mock('@/hooks/use-event', () => ({
  useEvent: () => ({ data: mockEvent, loading: false, error: undefined, notFound: false, reload: () => {} }),
}));
jest.mock('@/hooks/use-profile', () => ({ useProfile: () => ({ data: undefined, missing: false, reload: () => {} }) }));
jest.mock('@/hooks/use-applications', () => ({
  useEventApplication: () => ({ application: undefined, reload: () => {} }),
}));
// The mock events bundle images that the Jest mapper cannot find; a live event never reaches them.
jest.mock('@/mocks/events', () => ({ findMockEvent: () => undefined }));
jest.mock('@/hooks/use-matches', () => ({ useApplicationMatch: () => ({ match: undefined }) }));

describe('EventScreen', () => {
  test('shows the full title without a line limit', async () => {
    await render(<EventScreen />);

    const title = screen.getByRole('header', { name: LONG_TITLE });
    expect(title.props.numberOfLines).toBeUndefined();
  });
});
