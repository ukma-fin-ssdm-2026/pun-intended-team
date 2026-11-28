// Written with the help of Claude
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { describePlace } from '@/api/places';
import type { ApiResult } from '@/api/public-client';
import type { MapPoint } from '@/components/map/kyiv';
import { LOOKUP_DELAY_MS, usePlaceLookup } from '@/hooks/use-place-lookup';

jest.mock('@/api/places', () => ({ describePlace: jest.fn() }));

type Answer = Awaited<ReturnType<typeof describePlace>>;
const arsenal = { name: 'Мистецький Арсенал', address: 'вулиця Лаврська, 10-12' };
const first: MapPoint = { lat: 50.44, lng: 30.55 };
const second: MapPoint = { lat: 50.43, lng: 30.56 };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

async function settle(ms = LOOKUP_DELAY_MS) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('usePlaceLookup', () => {
  test('is idle without a point', async () => {
    const { result } = await renderHook(() => usePlaceLookup(undefined));

    await settle();

    expect(result.current).toEqual({ status: 'idle' });
    expect(describePlace).not.toHaveBeenCalled();
  });

  test('looks the point up once the map has rested', async () => {
    jest.mocked(describePlace).mockResolvedValue({ ok: true, data: arsenal });
    const { result } = await renderHook(() => usePlaceLookup(first));

    expect(result.current.status).toBe('loading');
    await settle(LOOKUP_DELAY_MS - 1);
    expect(describePlace).not.toHaveBeenCalled();

    await settle(1);

    expect(describePlace).toHaveBeenCalledWith(first);
    expect(result.current).toEqual({ status: 'found', place: arsenal });
  });

  test('asks only about the point the map rested on', async () => {
    jest.mocked(describePlace).mockResolvedValue({ ok: true, data: arsenal });
    const { result, rerender } = await renderHook((point: MapPoint) => usePlaceLookup(point), {
      initialProps: first,
    });

    await settle(LOOKUP_DELAY_MS / 2);
    await rerender(second);
    await settle();

    expect(describePlace).toHaveBeenCalledTimes(1);
    expect(describePlace).toHaveBeenCalledWith(second);
    expect(result.current.status).toBe('found');
  });

  test('ignores the answer for a point the map has left', async () => {
    let answerFirst: (answer: Answer) => void = () => {};
    jest
      .mocked(describePlace)
      .mockReturnValueOnce(new Promise<Answer>((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({ ok: true, data: { name: 'Лавра', address: 'вулиця Лаврська, 15' } });
    const { result, rerender } = await renderHook((point: MapPoint) => usePlaceLookup(point), {
      initialProps: first,
    });

    await settle();
    await rerender(second);
    expect(result.current.status).toBe('loading');
    await act(async () => answerFirst({ ok: true, data: arsenal }));
    expect(result.current.status).toBe('loading');

    await settle();

    expect(result.current).toEqual({ status: 'found', place: { name: 'Лавра', address: 'вулиця Лаврська, 15' } });
  });

  test.each<[string, ApiResult<never>, string]>([
    ['nothing is there', { ok: false, status: 404, code: 'NOT_FOUND' }, 'not-found'],
    ['OpenStreetMap cannot be reached', { ok: false, status: 503, code: 'PLACE_LOOKUP_UNAVAILABLE' }, 'unavailable'],
    ['the API cannot be reached', { ok: false, status: 0 }, 'unavailable'],
  ])('reports when %s', async (_case, answer, status) => {
    jest.mocked(describePlace).mockResolvedValue(answer);
    const { result } = await renderHook(() => usePlaceLookup(first));

    await settle();

    expect(result.current).toEqual({ status });
  });
});
