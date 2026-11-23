// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { markSafetyNoticeSeen, useSafetyNoticeSeen } from '@/state/safety-notice';

const mockStored = new Map<string, string>();
jest.mock('@/device-storage', () => ({
  deviceStorage: {
    get: async (key: string) => mockStored.get(key) ?? null,
    set: async (key: string, value: string) => void mockStored.set(key, value),
    remove: async (key: string) => void mockStored.delete(key),
  },
}));

// FR-032: the notice shows once per match on this device.
describe('useSafetyNoticeSeen', () => {
  beforeEach(() => mockStored.clear());

  test('remembers a seen match for this account only', async () => {
    const olena = await renderHook(() => useSafetyNoticeSeen('olena_k', 'm1'));
    await waitFor(() => expect(olena.result.current.loaded).toBe(true));
    expect(olena.result.current.seen).toBe(false);

    await act(() => markSafetyNoticeSeen('olena_k', 'm1'));

    expect(olena.result.current.seen).toBe(true);
    expect(JSON.parse(mockStored.get('nearby.safetyNoticeSeen.olena_k') ?? '[]')).toEqual(['m1']);
    const maksym = await renderHook(() => useSafetyNoticeSeen('maksym', 'm1'));
    await waitFor(() => expect(maksym.result.current.loaded).toBe(true));
    expect(maksym.result.current.seen).toBe(false);
  });

  test('keeps the latest 40 matches', async () => {
    for (let n = 1; n <= 41; n += 1) await markSafetyNoticeSeen('olena_k', `m${n}`);

    const ids = JSON.parse(mockStored.get('nearby.safetyNoticeSeen.olena_k') ?? '[]') as string[];
    expect(ids).toHaveLength(40);
    expect(ids[0]).toBe('m41');
    expect(ids).not.toContain('m1');
  });
});
