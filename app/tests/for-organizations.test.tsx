// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { publicClient } from '@/api/public-client';
import ForOrganizationsScreen from '@/app/for-organizations';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { isOrganizationSignUp } from '@/state/google-registration';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), canGoBack: () => true, back: jest.fn() }),
  useFocusEffect: () => {},
  Stack: { Screen: () => null },
}));
jest.mock('@/api/public-client', () => ({
  ...jest.requireActual<typeof import('@/api/public-client')>('@/api/public-client'),
  publicClient: { POST: jest.fn() },
}));
jest.mock('@/api/session', () => ({ startSession: jest.fn() }));
// Google's own sheet is native: the button hands back a token at once.
jest.mock('@/components/auth/google-button', () => {
  const { Pressable: Press, Text: Label } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GoogleButton: ({ onIdToken }: { onIdToken: (token: string) => void }) => (
      <Press accessibilityRole="button" onPress={() => onIdToken('id-token')}>
        <Label>Продовжити з Google</Label>
      </Press>
    ),
  };
});

// The onboarding's button, which signs up a person.
function PersonButton() {
  const google = useGoogleAuth();
  return (
    <Pressable accessibilityRole="button" onPress={() => void google.continueWithGoogle('id-token')}>
      <Text>Особистий акаунт</Text>
    </Pressable>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Not registered yet: the API answers 401 and the app goes to В5.
  jest
    .mocked(publicClient.POST)
    .mockResolvedValue({ error: { error: { code: 'UNAUTHORIZED' } }, response: { ok: false, status: 401 } } as never);
});

describe('ForOrganizationsScreen', () => {
  test('marks the sign-up of a new account as an organization', async () => {
    await render(<ForOrganizationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Продовжити з Google' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sign-up'));
    expect(isOrganizationSignUp()).toBe(true);
  });

  test('the onboarding button signs up a person again after it', async () => {
    await render(<ForOrganizationsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Продовжити з Google' }));
    await waitFor(() => expect(isOrganizationSignUp()).toBe(true));

    await render(<PersonButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Особистий акаунт' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(2));
    expect(isOrganizationSignUp()).toBe(false);
  });
});
