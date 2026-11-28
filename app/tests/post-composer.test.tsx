// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { uploadListingPhoto } from '@/api/images';
import { createListing, type Listing } from '@/api/listings';
import { PostComposer } from '@/components/announcements/post-composer';
import { formatShortDay, kyivDay, shiftMonth, monthOf } from '@/dates';
import type { PictureDraft } from '@/pictures/picked-picture';

jest.mock('@/api/client', () => ({ apiClient: {} }));
jest.mock('@/api/listings', () => ({ createListing: jest.fn() }));
jest.mock('@/api/images', () => ({ uploadListingPhoto: jest.fn() }));
jest.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({ data: [{ id: 'c1', name: 'Концерти' }], loading: false, error: undefined, reload: () => {} }),
}));
// The gallery and the crop preview need the device; here "Додати фото" hands back a cropped picture at once.
const mockDraft: PictureDraft = {
  picture: { uri: 'file:///photo.jpg', width: 1200, height: 800, type: 'image/jpeg' },
  crop: { left: 0, top: 100, width: 1200, height: 600 },
};
jest.mock('@/components/pictures/picture-cropper', () => ({
  usePictureCropper: (onCropped: (kind: string, draft: PictureDraft) => void) => ({
    start: async (kind: string) => onCropped(kind, mockDraft),
    cropper: null,
  }),
}));

const listing = { id: 'l1', title: 'Хто на джаз?' } as Listing;

async function writePost() {
  await fireEvent.changeText(screen.getByLabelText('Текст допису'), 'Хто на джаз?');
  await fireEvent.press(screen.getByRole('button', { name: 'Концерти' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createListing).mockResolvedValue({ ok: true, data: listing } as never);
});

describe('PostComposer', () => {
  test('has no controls without behaviour: no "Люди поруч" chip and no bare toolbar icons', async () => {
    await render(<PostComposer onPublished={() => {}} onAddPlace={() => {}} />);

    expect(screen.queryByText('Люди поруч · Київ')).toBeNull();
    expect(screen.getByRole('button', { name: 'Додати фото' })).toBeOnTheScreen();
  });

  describe('"Інша дата"', () => {
    const today = kyivDay(new Date());
    const next = shiftMonth(monthOf(today), 1);
    const picked = `${next.year}-${String(next.month).padStart(2, '0')}-15`;

    test('picks a later day in the calendar, shows it on the chip and sends it', async () => {
      const onPublished = jest.fn();
      await render(<PostComposer onPublished={onPublished} onAddPlace={() => {}} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Інша дата' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Наступний місяць' }));
      await fireEvent.press(screen.getByRole('button', { name: '15' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Обрати' }));

      const label = formatShortDay(`${picked}T12:00:00Z`);
      expect(screen.getByRole('button', { name: label }).props.accessibilityState).toEqual({ selected: true });

      await writePost();
      await fireEvent.press(screen.getByRole('button', { name: 'Опублікувати' }));

      expect(createListing).toHaveBeenCalledWith(expect.objectContaining({ date: picked }));
      expect(onPublished).toHaveBeenCalledWith(listing);
    });

    // The API takes today or later, Kyiv time, with no last day.
    test('cannot go back before this month or pick a past day', async () => {
      await render(<PostComposer onPublished={() => {}} onAddPlace={() => {}} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Інша дата' }));

      expect(screen.getByRole('button', { name: 'Попередній місяць' })).toBeDisabled();
      const day = Number(today.slice(8));
      if (day > 1) expect(screen.getByRole('button', { name: String(day - 1) })).toBeDisabled();
      expect(screen.getByRole('button', { name: String(day) })).toBeEnabled();
    });
  });

  describe('photo', () => {
    test('is added, replaced and removed in the editor', async () => {
      await render(<PostComposer onPublished={() => {}} onAddPlace={() => {}} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Додати фото' }));

      expect(screen.getByRole('button', { name: 'Прибрати фото' })).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'Змінити фото' })).toHaveLength(2);

      await fireEvent.press(screen.getByRole('button', { name: 'Прибрати фото' }));

      expect(screen.queryByRole('button', { name: 'Прибрати фото' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Додати фото' })).toBeOnTheScreen();
    });

    test('is uploaded once the listing is created', async () => {
      const withPhoto = { ...listing, photo: { id: 'p1', width: 1200, height: 600 } } as Listing;
      jest.mocked(uploadListingPhoto).mockResolvedValue({ ok: true, data: withPhoto });
      const onPublished = jest.fn();
      await render(<PostComposer onPublished={onPublished} onAddPlace={() => {}} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Додати фото' }));
      await writePost();
      await fireEvent.press(screen.getByRole('button', { name: 'Опублікувати' }));

      await waitFor(() => expect(onPublished).toHaveBeenCalledWith(withPhoto));
      expect(uploadListingPhoto).toHaveBeenCalledWith('l1', mockDraft);
    });

    // The screen then keeps the post and says it went out without the photo.
    test('that fails to upload still publishes the post and hands over the failure', async () => {
      const failure = { ok: false as const, status: 413, code: 'PAYLOAD_TOO_LARGE' };
      jest.mocked(uploadListingPhoto).mockResolvedValue(failure);
      const onPublished = jest.fn();
      await render(<PostComposer onPublished={onPublished} onAddPlace={() => {}} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Додати фото' }));
      await writePost();
      await fireEvent.press(screen.getByRole('button', { name: 'Опублікувати' }));

      await waitFor(() => expect(onPublished).toHaveBeenCalledWith(listing, failure));
    });
  });
});
