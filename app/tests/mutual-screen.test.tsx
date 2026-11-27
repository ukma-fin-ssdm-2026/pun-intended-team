// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { render } from '@testing-library/react-native';

import MutualMatchScreen from '@/app/mutual';

const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
  useRouter: () => ({}),
}));
// The real client signs requests through the session, which needs the device's push and secure storage.
jest.mock('@/api/client', () => ({ apiClient: {} }));
jest.mock('@/api/session', () => ({ currentAccessToken: jest.fn(() => Promise.resolve(undefined)) }));

describe('MutualMatchScreen', () => {
  test('without a match id, returns to Метчі', async () => {
    await render(<MutualMatchScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({ href: '/matches' });
  });
});
