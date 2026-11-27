// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { deleteOrganizationLogo, uploadOrganizationLogo } from '@/api/images';
import {
  getMyOrganization,
  requestOrganizationStatus,
  setOrganizationInstagram,
  type Organization,
} from '@/api/organizations';
import OrganizationSettingsScreen from '@/app/organization/settings';
import type { PictureDraft } from '@/pictures/picked-picture';
import { clearOwnOrganization } from '@/state/organization';
import { setSignedIn } from '@/state/session';

jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => {} }));
jest.mock('@/api/session', () => ({ signOut: jest.fn() }));
jest.mock('@/api/organizations', () => ({
  getMyOrganization: jest.fn(),
  requestOrganizationStatus: jest.fn(),
  setOrganizationInstagram: jest.fn(),
}));
jest.mock('@/api/images', () => ({ uploadOrganizationLogo: jest.fn(), deleteOrganizationLogo: jest.fn() }));
// The gallery and the crop preview are native: picking hands back this draft at once.
const draft: PictureDraft = {
  picture: { uri: 'file:///logo.png', width: 400, height: 400, type: 'image/png' },
  crop: { left: 0, top: 0, width: 400, height: 400 },
};
jest.mock('@/components/pictures/picture-cropper', () => ({
  usePictureCropper: (onCropped: (kind: string, picked: PictureDraft) => void) => ({
    start: async (kind: string) => onCropped(kind, draft),
    cropper: null,
  }),
}));
jest.mock('@/components/pictures/picture', () => ({ ApiPicture: () => null, Picture: () => null }));

const logo = { id: '4f1d2c3b-6a5e-4d7c-9b8a-1e2f3a4b5c6d', width: 400, height: 400 };

const rejected: Organization = {
  name: 'Riverside Stage',
  description: 'Open-air concerts.',
  officialLink: 'https://riverside.example.org',
  instagram: null,
  verificationStatus: 'rejected',
  verifiedAt: null,
  logo: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // The request loads for a signed-in account, once per session.
  setSignedIn(true);
  clearOwnOrganization();
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
    expect(setOrganizationInstagram).not.toHaveBeenCalled();
  });

  test('prefills the Instagram username and saves the edited one on its own', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: true, data: { ...rejected, instagram: 'riverside' } });
    jest
      .mocked(setOrganizationInstagram)
      .mockResolvedValue({ ok: true, data: { ...rejected, instagram: 'riverside.stage' } });
    await render(<OrganizationSettingsScreen />);

    await fireEvent.changeText(await screen.findByDisplayValue('@riverside'), 'instagram.com/riverside.stage');
    await fireEvent.press(screen.getByRole('button', { name: 'Зберегти Instagram' }));

    await waitFor(() => expect(setOrganizationInstagram).toHaveBeenCalledWith('instagram.com/riverside.stage'));
    expect(await screen.findByText('Instagram збережено')).toBeOnTheScreen();
    expect(requestOrganizationStatus).not.toHaveBeenCalled();
  });

  test('lets a verified organization change its Instagram, which keeps it verified', async () => {
    const verified = { ...rejected, verificationStatus: 'verified' as const, verifiedAt: '2026-11-08T10:00:00.000Z' };
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: true, data: verified });
    jest
      .mocked(setOrganizationInstagram)
      .mockResolvedValue({ ok: true, data: { ...verified, instagram: 'riverside' } });
    await render(<OrganizationSettingsScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Instagram'), '@riverside');
    await fireEvent.press(screen.getByRole('button', { name: 'Зберегти Instagram' }));

    await waitFor(() => expect(setOrganizationInstagram).toHaveBeenCalledWith('@riverside'));
    expect(await screen.findByText('Підтверджено')).toBeOnTheScreen();
  });

  test('shows a refused Instagram in the snackbar', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: true, data: rejected });
    jest.mocked(setOrganizationInstagram).mockResolvedValue({ ok: false, status: 422, code: 'INVALID_SOCIAL_HANDLE' });
    await render(<OrganizationSettingsScreen />);

    await fireEvent.changeText(await screen.findByLabelText('Instagram'), '..nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Зберегти Instagram' }));

    expect(await screen.findByText('Перевір Instagram')).toBeOnTheScreen();
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

  test('saves an Instagram typed before the first request right after it', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: false, status: 404, code: 'NOT_FOUND' });
    jest.mocked(requestOrganizationStatus).mockResolvedValue({ ok: true, data: rejected });
    jest
      .mocked(setOrganizationInstagram)
      .mockResolvedValue({ ok: true, data: { ...rejected, instagram: 'riverside' } });
    await render(<OrganizationSettingsScreen />);

    expect(await screen.findByText('Не підтверджено')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Назва'), 'Riverside Stage');
    await fireEvent.changeText(screen.getByLabelText('Опис'), 'Open-air concerts.');
    await fireEvent.changeText(screen.getByLabelText('Сайт'), 'riverside.example.org');
    await fireEvent.changeText(screen.getByLabelText('Instagram'), '@riverside');
    await fireEvent.press(screen.getByRole('button', { name: 'Надіслати на перевірку' }));

    await waitFor(() => expect(setOrganizationInstagram).toHaveBeenCalledWith('@riverside'));
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

  test('saves a picked logo at once and removes it again', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: true, data: rejected });
    jest.mocked(uploadOrganizationLogo).mockResolvedValue({ ok: true, data: { ...rejected, logo } });
    jest.mocked(deleteOrganizationLogo).mockResolvedValue({ ok: true, data: rejected });
    await render(<OrganizationSettingsScreen />);
    await screen.findByText('Відхилено');

    await fireEvent.press(screen.getByRole('button', { name: 'Змінити логотип' }));

    await waitFor(() => expect(uploadOrganizationLogo).toHaveBeenCalledWith(draft));
    await fireEvent.press(await screen.findByRole('button', { name: 'Прибрати логотип' }));
    await waitFor(() => expect(deleteOrganizationLogo).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Прибрати логотип' })).toBeNull();
  });

  test('keeps a logo picked before the first request and saves it after the request', async () => {
    jest.mocked(getMyOrganization).mockResolvedValue({ ok: false, status: 404, code: 'NOT_FOUND' });
    jest
      .mocked(requestOrganizationStatus)
      .mockResolvedValue({ ok: true, data: { ...rejected, verificationStatus: 'pending' } });
    jest
      .mocked(uploadOrganizationLogo)
      .mockResolvedValue({ ok: true, data: { ...rejected, verificationStatus: 'pending', logo } });
    await render(<OrganizationSettingsScreen />);
    await screen.findByText('Не підтверджено');

    await fireEvent.press(screen.getByRole('button', { name: 'Змінити логотип' }));
    expect(await screen.findByRole('button', { name: 'Прибрати логотип' })).toBeOnTheScreen();
    expect(uploadOrganizationLogo).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Назва'), 'Riverside Stage');
    await fireEvent.changeText(screen.getByLabelText('Опис'), 'Open-air concerts.');
    await fireEvent.changeText(screen.getByLabelText('Сайт'), 'riverside.example.org');
    await fireEvent.press(screen.getByRole('button', { name: 'Надіслати на перевірку' }));

    await waitFor(() => expect(uploadOrganizationLogo).toHaveBeenCalledWith(draft));
    expect(await screen.findByText('На перевірці')).toBeOnTheScreen();
  });
});
