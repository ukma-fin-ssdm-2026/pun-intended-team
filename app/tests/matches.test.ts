// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { Application } from '@/state/applications';
import type { Match } from '@/state/matches';

type Call = jest.Mock<(path: string, init?: unknown) => Promise<unknown>>;

// The real client signs requests through the session, which needs the device's secure storage.
jest.mock('@/api/client', () => ({ apiClient: { GET: jest.fn(), POST: jest.fn() } }));

// Each test loads the modules afresh, since the stores keep the matches and applications in module state.
function load() {
  const api = require('@/api/matches') as typeof import('@/api/matches');
  const state = require('@/state/matches') as typeof import('@/state/matches');
  const applications = require('@/state/applications') as typeof import('@/state/applications');
  const { apiClient } = require('@/api/client') as { apiClient: { GET: Call; POST: Call } };
  return { ...api, ...state, applications, get: apiClient.GET, post: apiClient.POST };
}

function aMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    eventId: 'e1',
    applicationId: 'a1',
    status: 'proposed',
    days: [{ startsAt: '2026-10-25T17:00:00.000Z', cutoffAt: '2026-10-25T16:00:00.000Z' }],
    validUntil: '2026-10-16T09:00:00.000Z',
    partner: {
      username: 'olena_k',
      displayName: 'Олена',
      description: '',
      occupation: 'Ілюстраторка',
      age: 24,
      interests: [],
      desiredCompany: 'company',
      afterEventPlans: ['walk'],
    },
    createdAt: '2026-10-15T09:00:00.000Z',
    ...overrides,
  };
}

function anApplication(): Application {
  return {
    id: 'a1',
    eventId: 'e1',
    sessions: [{ startsAt: '2026-10-25T17:00:00.000Z', cutoffAt: '2026-10-25T16:00:00.000Z' }],
    cutoffAt: '2026-10-25T16:00:00.000Z',
    desiredCompany: 'company',
    afterEventPlans: ['walk'],
    preferredGender: 'any',
    ageMin: 18,
    ageMax: null,
    status: 'paired',
    nextRoundAt: null,
    createdAt: '2026-10-15T09:00:00.000Z',
  };
}

const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });

beforeEach(() => {
  jest.resetModules();
});

describe('putMatch', () => {
  test('keeps the soonest shared day first and drops a declined match', () => {
    const { putMatch, setMatchesState, matchesState } = load();
    const later = aMatch({
      id: 'later',
      days: [{ startsAt: '2026-10-28T17:00:00.000Z', cutoffAt: '2026-10-28T16:00:00.000Z' }],
    });
    setMatchesState({ status: 'loaded', matches: [later] });

    putMatch(aMatch({ id: 'sooner', status: 'accepted' }));
    expect(matchesState().matches?.map(({ id }) => id)).toEqual(['sooner', 'later']);

    putMatch(aMatch({ id: 'later', status: 'declined' }));
    expect(matchesState().matches?.map(({ id }) => id)).toEqual(['sooner']);
  });

  test('drops what an answer of an earlier session returns', () => {
    const { putMatch, setMatchesState, matchesState, matchesSession, clearMatches } = load();
    const from = matchesSession();
    clearMatches();
    setMatchesState({ status: 'loaded', matches: [] });

    putMatch(aMatch(), from);

    expect(matchesState().matches).toEqual([]);
  });
});

describe('answering a match', () => {
  test('puts the accepted match in and has the applications loaded again', async () => {
    const { acceptMatch, setMatchesState, matchesState, applications, post } = load();
    setMatchesState({ status: 'loaded', matches: [aMatch()] });
    applications.setApplicationsState({ status: 'loaded', applications: [anApplication()] });
    post.mockResolvedValueOnce(ok(aMatch({ status: 'accepted' })));

    const result = await acceptMatch('m1');

    expect(result.ok).toBe(true);
    expect(post.mock.calls[0]).toEqual(['/api/v1/matches/{id}/accept', { params: { path: { id: 'm1' } } }]);
    expect(matchesState().matches?.[0]?.status).toBe('accepted');
    expect(applications.applicationsState().status).toBe('idle');
  });

  test('drops a declined match from the list', async () => {
    const { declineMatch, setMatchesState, matchesState, post } = load();
    setMatchesState({ status: 'loaded', matches: [aMatch()] });
    post.mockResolvedValueOnce(ok(aMatch({ status: 'declined' })));

    await declineMatch('m1');

    expect(post.mock.calls[0]?.[0]).toBe('/api/v1/matches/{id}/decline');
    expect(matchesState().matches).toEqual([]);
  });
});

describe('withdrawing an application', () => {
  test('has the matches loaded again, since a pending proposal is cancelled with it', async () => {
    const { setMatchesState, matchesState, post } = load();
    const { withdrawApplication } = require('@/api/applications') as typeof import('@/api/applications');
    setMatchesState({ status: 'loaded', matches: [aMatch()] });
    post.mockResolvedValueOnce(ok({ ...anApplication(), status: 'withdrawn' }));

    await withdrawApplication('a1');

    expect(matchesState().status).toBe('idle');
  });
});
