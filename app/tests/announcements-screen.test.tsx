// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Listing } from '@/api/listings';
import AnnouncementsScreen from '@/app/(tabs)/announcements';
import { useIsDesktop } from '@/hooks/use-is-desktop';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/api/client', () => ({ apiClient: {} }));
jest.mock('@/hooks/use-status-bar-style', () => ({ useStatusBarStyle: () => {} }));
jest.mock('@/hooks/use-is-desktop', () => ({ useIsDesktop: jest.fn(() => false) }));
jest.mock('@/hooks/use-event', () => ({ useEvent: () => ({ data: undefined }) }));
jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { username: 'daryna' }, loading: false, reload: () => {} }),
}));
jest.mock('@/state/session', () => ({
  useSession: () => ({ isGuest: false, announcementsEmpty: false }),
  openGuestDialog: () => {},
}));
// The editor is checked on its own; here it only hands a published listing to the screen.
let mockOnPublished: ((listing: Listing, failure?: unknown) => void) | undefined;
jest.mock('@/components/announcements/post-composer', () => ({
  PostComposer: ({ onPublished }: { onPublished: (listing: Listing, failure?: unknown) => void }) => {
    mockOnPublished = onPublished;
    return null;
  },
}));
const mockSetData = jest.fn();

function aListing(id: string, title: string, username = 'olena'): Listing {
  return {
    id,
    author: { username, displayName: username === 'daryna' ? 'Дарина' : 'Олена', photo: null },
    category: { id: 'c1', name: 'Концерти' },
    title,
    description: '',
    date: '2026-12-01',
    eventId: null,
    photo: null,
    place: null,
    myRequest: null,
    likeCount: 0,
    liked: false,
  } as Listing;
}

const mockListings = [
  aListing('l1', 'Хто на джаз?'),
  aListing('l2', 'Настолки в неділю'),
  aListing('l3', 'Кіно', 'daryna'),
];
jest.mock('@/hooks/use-listings', () => ({
  useListings: () => ({
    data: mockListings,
    loading: false,
    failure: undefined,
    reload: () => {},
    setData: mockSetData,
    updateData: () => {},
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useIsDesktop).mockReturnValue(false);
});

describe('AnnouncementsScreen', () => {
  test('offers only the tabs that do something: every post and the own ones', async () => {
    await render(<AnnouncementsScreen />);

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByText('Для тебе')).toBeNull();
    expect(screen.queryByText('Поруч')).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: 'Мої' }));

    expect(screen.getByText('Кіно')).toBeOnTheScreen();
    expect(screen.queryByText('Хто на джаз?')).toBeNull();
  });

  test('on a phone, the search narrows the feed and has no tabs of its own', async () => {
    await render(<AnnouncementsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Пошук' }));
    expect(screen.queryByText('Популярне')).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText('Пошук оголошень'), 'джаз');

    expect(screen.getByText('Хто на джаз?')).toBeOnTheScreen();
    expect(screen.queryByText('Настолки в неділю')).toBeNull();
  });

  test('keeps a post whose photo failed to upload and says it went out without the photo', async () => {
    await render(<AnnouncementsScreen />);
    await fireEvent.press(screen.getByText('Що плануєш? Знайди компанію…'));
    const created = aListing('l4', 'Новий допис', 'daryna');

    await act(async () => mockOnPublished?.(created, { ok: false, status: 500 }));

    expect(mockSetData).toHaveBeenCalledWith(expect.arrayContaining([created]));
    expect(screen.getByText('Допис опубліковано без фото')).toBeOnTheScreen();
  });

  describe('on a desktop', () => {
    beforeEach(() => {
      jest.mocked(useIsDesktop).mockReturnValue(true);
    });

    test('filters the feed as the query is typed and shows it whole once cleared', async () => {
      await render(<AnnouncementsScreen />);
      const field = screen.getByPlaceholderText('Пошук оголошень');

      await fireEvent.changeText(field, 'настолки');
      expect(screen.getByText('Настолки в неділю')).toBeOnTheScreen();
      expect(screen.queryByText('Хто на джаз?')).toBeNull();

      await fireEvent.changeText(field, '');
      expect(screen.getByText('Настолки в неділю')).toBeOnTheScreen();
      expect(screen.getByText('Хто на джаз?')).toBeOnTheScreen();
    });

    test('shows "Нічого не знайшли" when no post matches', async () => {
      await render(<AnnouncementsScreen />);

      await fireEvent.changeText(screen.getByPlaceholderText('Пошук оголошень'), 'опера');

      expect(screen.getByText('Нічого не знайшли')).toBeOnTheScreen();
    });

    test('switches to the own posts from the left column, without tabs in the feed', async () => {
      await render(<AnnouncementsScreen />);

      expect(screen.getAllByRole('tab')).toHaveLength(2);
      await fireEvent.press(screen.getByRole('tab', { name: 'Мої оголошення' }));

      expect(screen.getByText('Кіно')).toBeOnTheScreen();
      expect(screen.queryByText('Хто на джаз?')).toBeNull();
    });
  });
});
