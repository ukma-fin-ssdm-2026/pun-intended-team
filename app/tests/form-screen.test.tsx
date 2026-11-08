// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FormScreen } from '@/components/profile/profile-form';

const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() };
// useFocusEffect sets the status bar style; there is no navigator to focus here.
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useFocusEffect: () => {} }));

beforeEach(() => {
  jest.clearAllMocks();
});

async function renderForm() {
  await render(
    <FormScreen title="Редагувати профіль" backTo="/profile" action={{ label: 'Зберегти', onPress: () => {} }}>
      <Text>Поля</Text>
    </FormScreen>,
  );
}

describe('FormScreen', () => {
  test('goes back through the history', async () => {
    await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Назад' }));

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('opens its fallback screen when there is no history, e.g. after a reload on the web', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Назад' }));

    expect(mockRouter.replace).toHaveBeenCalledWith('/profile');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
