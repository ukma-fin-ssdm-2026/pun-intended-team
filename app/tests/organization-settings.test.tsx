// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { getMyOrganization, requestOrganizationStatus, type Organization } from '@/api/organizations';
import OrganizationSettingsScreen from '@/app/organization/settings';

jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => {} }));
// The mock module loads event images that Jest cannot resolve.
jest.mock('@/mocks/organization', () => ({ mockOrganizationSettings: { instagram: '@riverside' } }));
jest.mock('@/api/session', () => ({ signOut: jest.fn() }));
jest.mock('@/api/organizations', () => ({ getMyOrganization: jest.fn(), requestOrganizationStatus: jest.fn() }));

const rejected: Organization = {
  name: 'Riverside Stage',
  description: 'Open-air concerts.',
  officialLink: 'https://riverside.example.org',
  verificationStatus: 'rejected',
  verifiedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// FR-003
describe('OrganizationSettingsScreen', () => {
  test('shows a rejected request and sends it again with the edited fields', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: true, data: rejected });
    jest
      .mocked(requestOrganizationStatus)
      .mockResolvedValue({ ok: true, data: { ...rejected, name: 'Riverside', verificationStatus: 'pending' } });
    await render(<OrganizationSettingsScreen />);

    expect(await screen.findByText('Відхилено')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByDisplayValue('Riverside Stage'), 'Riverside');
    await fireEvent.press(screen.getByRole('button', { name: 'Надіслати ще раз' }));

    await waitFor(() => expect(screen.getByText('На перевірці')).toBeOnTheScreen());
    expect(requestOrganizationStatus).toHaveBeenCalledWith({
      name: 'Riverside',
      description: 'Open-air concerts.',
      officialLink: 'https://riverside.example.org',
    });
  });

  test('offers the first request to an account without one, adding https to the site', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: false, status: 404, code: 'NOT_FOUND' });
    jest.mocked(requestOrganizationStatus).mockResolvedValue({ ok: true, data: rejected });
    await render(<OrganizationSettingsScreen />);

    expect(await screen.findByText('Не підтверджено')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Назва'), 'Riverside Stage');
    await fireEvent.changeText(screen.getByLabelText('Опис'), 'Open-air concerts.');
    await fireEvent.changeText(screen.getByLabelText('Сайт'), 'riverside.example.org');
    await fireEvent.press(screen.getByRole('button', { name: 'Надіслати на перевірку' }));

    await waitFor(() =>
      expect(requestOrganizationStatus).toHaveBeenCalledWith({
        name: 'Riverside Stage',
        description: 'Open-air concerts.',
        officialLink: 'https://riverside.example.org',
      }),
    );
  });

  test('offers no request to a verified organization', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({
      ok: true,
      data: { ...rejected, verificationStatus: 'verified', verifiedAt: '2026-11-08T10:00:00.000Z' },
    });
    await render(<OrganizationSettingsScreen />);

    expect(await screen.findByText('Підтверджено')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Надіслати|Оновити/ })).toBeNull();
  });
});
