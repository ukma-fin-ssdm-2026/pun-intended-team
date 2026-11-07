// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiClient } from '@/api/client';
import { useInterests } from '@/hooks/use-interests';

// The real client signs requests through the session, which needs the device's secure storage.
jest.mock('@/api/client', () => ({ apiClient: { GET: jest.fn() } }));

const get = apiClient.GET as unknown as jest.Mock<(path: string) => Promise<unknown>>;
const films = { id: 'films', name: 'Кіно', group: 'Культура' };

function answer(status: number, data?: unknown) {
  return {
    data,
    error: data ? undefined : { error: { code: 'SERVICE_UNAVAILABLE' } },
    response: { ok: status < 400, status },
  };
}

beforeEach(() => {
  get.mockReset();
});

describe('useInterests', () => {
  test('loads the list of interests', async () => {
    get.mockResolvedValueOnce(answer(200, { items: [films] }));
    const { result } = await renderHook(() => useInterests());

    await waitFor(() => expect(result.current.data).toEqual([films]));
    expect(result.current.failed).toBe(false);
    expect(get).toHaveBeenCalledWith('/api/v1/interests');
  });

  // REL-07: a failure is reported and a retry loads the list.
  test.each([
    ['the server cannot be reached', () => Promise.reject(new TypeError('Network request failed'))],
    ['the server answers 503', () => Promise.resolve(answer(503))],
  ])('reports a failure when %s, and loads the list on a retry', async (_case, fail) => {
    get.mockImplementationOnce(fail).mockResolvedValueOnce(answer(200, { items: [films] }));
    const { result } = await renderHook(() => useInterests());

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.data).toBeUndefined();

    await act(async () => result.current.reload());

    await waitFor(() => expect(result.current.data).toEqual([films]));
    expect(result.current.failed).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
