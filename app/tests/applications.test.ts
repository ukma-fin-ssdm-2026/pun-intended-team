// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { Application } from '@/state/applications';

type Call = jest.Mock<(path: string, init?: unknown) => Promise<unknown>>;

// The real client signs requests through the session, which needs the device's secure storage.
jest.mock('@/api/client', () => ({ apiClient: { GET: jest.fn(), POST: jest.fn() } }));

// Each test loads the modules afresh, since the store keeps the applications in module state.
function load() {
  const api = require('@/api/applications') as typeof import('@/api/applications');
  const state = require('@/state/applications') as typeof import('@/state/applications');
  const { apiClient } = require('@/api/client') as { apiClient: { GET: Call; POST: Call } };
  return { ...api, ...state, get: apiClient.GET, post: apiClient.POST };
}

function anApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    eventId: 'e1',
    sessionStartsAt: '2026-10-25T17:00:00.000Z',
    cutoffAt: '2026-10-25T16:00:00.000Z',
    desiredCompany: 'company',
    afterEventPlans: ['walk'],
    status: 'in_pool',
    nextRoundAt: '2026-10-18T17:00:00.000Z',
    createdAt: '2026-10-15T09:00:00.000Z',
    ...overrides,
  };
}

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
const refused = (status: number, code: string) => ({ error: { error: { code } }, response: { ok: false, status } });

beforeEach(() => {
  jest.resetModules();
});

describe('putApplication', () => {
  test('adds an active application, soonest session first, and drops a withdrawn one', () => {
    const { putApplication, setApplicationsState, applicationsState } = load();
    const later = anApplication({ id: 'later', sessionStartsAt: '2026-10-28T17:00:00.000Z' });
    setApplicationsState({ status: 'loaded', applications: [later] });

    putApplication(anApplication({ id: 'sooner' }));
    expect(applicationsState().applications?.map(({ id }) => id)).toEqual(['sooner', 'later']);

    putApplication(anApplication({ id: 'later', status: 'withdrawn' }));
    expect(applicationsState().applications?.map(({ id }) => id)).toEqual(['sooner']);
  });

  test('drops what a save of an earlier session returns', () => {
    const { putApplication, setApplicationsState, applicationsState, applicationsSession, clearApplications } = load();
    const from = applicationsSession();
    clearApplications();
    setApplicationsState({ status: 'loaded', applications: [] });

    putApplication(anApplication(), from);

    expect(applicationsState().applications).toEqual([]);
  });
});

describe('changeAnswers', () => {
  const answers = { desiredCompany: 'dating' as const, afterEventPlans: [] };

  test('withdraws the application and applies again for the same day with the new answers', async () => {
    const { changeAnswers, post } = load();
    post
      .mockResolvedValueOnce(ok(anApplication({ status: 'withdrawn' })))
      .mockResolvedValueOnce(ok(anApplication({ id: 'a2', desiredCompany: 'dating', afterEventPlans: [] })));

    const result = await changeAnswers(anApplication(), answers);

    expect(result.ok).toBe(true);
    expect(post.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/applications/{id}/withdraw',
      '/api/v1/events/{id}/applications',
    ]);
    expect(post.mock.calls[1]?.[1]).toEqual({
      params: { path: { id: 'e1' } },
      body: { ...answers, date: '2026-10-25' },
    });
  });

  test('applies again with the old answers when the new application is refused', async () => {
    const { changeAnswers, post } = load();
    post
      .mockResolvedValueOnce(ok(anApplication({ status: 'withdrawn' })))
      .mockResolvedValueOnce(refused(422, 'APPLICATIONS_CLOSED'))
      .mockResolvedValueOnce(ok(anApplication({ id: 'a3' })));

    const result = await changeAnswers(anApplication(), answers);

    expect(result).toMatchObject({ ok: false, code: 'APPLICATIONS_CLOSED' });
    expect(post.mock.calls[2]?.[1]).toMatchObject({
      body: { desiredCompany: 'company', afterEventPlans: ['walk'] },
    });
  });

  test('stops when the withdrawal is refused', async () => {
    const { changeAnswers, post } = load();
    post.mockResolvedValueOnce(refused(409, 'CONFLICT'));

    const result = await changeAnswers(anApplication(), answers);

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('matchingPhase', () => {
  const now = new Date('2026-10-25T12:00:00.000Z');

  test('waits for a round while one is coming', () => {
    const { matchingPhase } = load();
    expect(matchingPhase(anApplication(), now)).toBe('rounds');
  });

  test('is in open mode with no round left before the cutoff', () => {
    const { matchingPhase } = load();
    expect(matchingPhase(anApplication({ nextRoundAt: null }), now)).toBe('open');
  });

  test('is over once the cutoff has passed', () => {
    const { matchingPhase } = load();
    expect(matchingPhase(anApplication({ nextRoundAt: null, cutoffAt: '2026-10-25T11:00:00.000Z' }), now)).toBe('over');
  });
});
