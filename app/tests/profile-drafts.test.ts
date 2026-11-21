// Written with the help of Claude
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { clearProfileDrafts, loadProfileDraft, useProfileDraft, useStoredProfileDraft } from '@/state/profile-drafts';

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  File: class {
    mockName: string;
    constructor(_directory: string, mockName: string) {
      this.mockName = mockName;
    }
    get exists() {
      return mockFiles.has(this.mockName);
    }
    async text() {
      return mockFiles.get(this.mockName) ?? '';
    }
    write(text: string) {
      mockFiles.set(this.mockName, text);
    }
    delete() {
      mockFiles.delete(this.mockName);
    }
  },
}));

type Draft = { name: string };

// FR-004, TC-99
describe('useProfileDraft', () => {
  beforeEach(() => {
    mockFiles.clear();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('saves the values shortly after a change, and they can be read back', async () => {
    const { rerender } = await renderHook(({ name }: Draft) => useProfileDraft<Draft>('setup', { name }, false), {
      initialProps: { name: 'Оле' },
    });
    await rerender({ name: 'Олена' });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await loadProfileDraft<Draft>('setup')).toEqual({ name: 'Олена' });
  });

  test('saves at once when the form closes', async () => {
    const { unmount } = await renderHook(() => useProfileDraft<Draft>('edit', { name: 'Олена' }, false));

    await act(async () => unmount());

    expect(await loadProfileDraft<Draft>('edit')).toEqual({ name: 'Олена' });
  });

  test('removes the draft once the values are back to the saved ones', async () => {
    mockFiles.set('nearby-profile-draft-edit.json', JSON.stringify({ name: 'Олена' }));

    await renderHook(() => useProfileDraft<Draft>('edit', { name: 'Olena' }, true));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await loadProfileDraft<Draft>('edit')).toBeUndefined();
  });

  test('keeps nothing after a successful save, even when the form closes', async () => {
    const { result, unmount } = await renderHook(() => useProfileDraft<Draft>('setup', { name: 'Олена' }, false));

    await act(async () => result.current());
    await act(async () => unmount());

    expect(await loadProfileDraft<Draft>('setup')).toBeUndefined();
  });
});

describe('useStoredProfileDraft', () => {
  beforeEach(() => mockFiles.clear());

  test('reads the stored draft, and drop deletes it and starts the form again', async () => {
    mockFiles.set('nearby-profile-draft-contacts.json', JSON.stringify({ name: 'Олена' }));
    const { result } = await renderHook(() => useStoredProfileDraft<Draft>('contacts'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.draft).toEqual({ name: 'Олена' });

    await act(async () => result.current.drop());

    expect(result.current.draft).toBeUndefined();
    expect(result.current.version).toBe(1);
    expect(mockFiles.size).toBe(0);
  });

  test('ignores a draft that cannot be read', async () => {
    mockFiles.set('nearby-profile-draft-setup.json', '{ not json');

    expect(await loadProfileDraft<Draft>('setup')).toBeUndefined();
  });
});

describe('clearProfileDrafts', () => {
  test('removes every draft, as on sign-out', async () => {
    for (const kind of ['setup', 'contacts', 'edit']) mockFiles.set(`nearby-profile-draft-${kind}.json`, '{}');

    await clearProfileDrafts();

    expect(mockFiles.size).toBe(0);
  });
});
