// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { getOrganization, loadOrganizationEvents, type PublicOrganization } from '@/api/organizations';
import OrganizerScreen from '@/app/organizers/[id]';

import { anEvent } from './fixtures/events';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'o1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/api/organizations', () => ({ getOrganization: jest.fn(), loadOrganizationEvents: jest.fn() }));
jest.mock('@/components/pictures/picture', () => ({ ApiPicture: () => null }));
jest.mock('@/hooks/use-status-bar-style', () => ({ useStatusBarStyle: () => {} }));

const arsenal: PublicOrganization = {
  id: 'o1',
  name: 'Подільський кіноклуб',
  description: 'Культурний комплекс у центрі Києва.',
  officialLink: 'https://artarsenal.in.ua',
  instagram: null,
  logo: null,
};

function load(organization: PublicOrganization, events = [anEvent('e1', 'Джаз-вечір'), anEvent('e2', 'Лекція')]) {
  jest.mocked(getOrganization).mockResolvedValue({ ok: true, data: organization });
  jest.mocked(loadOrganizationEvents).mockResolvedValue({ ok: true, data: events });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OrganizerScreen', () => {
  test('shows the organization and its events, and opens an event', async () => {
    load(arsenal);
    await render(<OrganizerScreen />);

    expect(await screen.findByText('Подільський кіноклуб')).toBeOnTheScreen();
    expect(screen.getByText('Культурний комплекс у центрі Києва.')).toBeOnTheScreen();
    expect(screen.getByText('2 події')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Джаз-вечір'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/events/[id]', params: { id: 'e1' } });
  });

  test('links Instagram only when the organization has one', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    load(arsenal);
    const { unmount } = await render(<OrganizerScreen />);

    expect(await screen.findByRole('link', { name: 'Сайт' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Instagram' })).toBeNull();
    await unmount();

    load({ ...arsenal, instagram: 'artarsenal' });
    await render(<OrganizerScreen />);
    await fireEvent.press(await screen.findByRole('link', { name: 'Instagram' }));
    expect(openURL).toHaveBeenCalledWith('https://instagram.com/artarsenal');
  });

  test('says when there are no events yet', async () => {
    load(arsenal, []);
    await render(<OrganizerScreen />);

    expect(await screen.findByText('Поки немає подій')).toBeOnTheScreen();
    expect(screen.getByText('0 подій')).toBeOnTheScreen();
  });

  test('says the organizer is not found on 404, without a retry', async () => {
    jest.mocked(getOrganization).mockResolvedValue({ ok: false, status: 404, code: 'NOT_FOUND' });
    jest.mocked(loadOrganizationEvents).mockResolvedValue({ ok: false, status: 404, code: 'NOT_FOUND' });
    await render(<OrganizerScreen />);

    expect(await screen.findByText('Організатора не знайдено')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull();
  });

  test('offers a retry when loading fails', async () => {
    jest.mocked(getOrganization).mockResolvedValue({ ok: false, status: 0 });
    jest.mocked(loadOrganizationEvents).mockResolvedValue({ ok: true, data: [] });
    await render(<OrganizerScreen />);

    expect(await screen.findByText('Не вдалося завантажити організатора')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeOnTheScreen();
  });
});
