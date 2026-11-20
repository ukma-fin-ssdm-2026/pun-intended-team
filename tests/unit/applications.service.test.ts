// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { EventSessionsService } from '../../dist/core/catalog/services/event-sessions.service.js';
import type { EventSession, OpenedSession } from '../../dist/core/catalog/types/event-session.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { ApplicationsRepository } from '../../dist/core/matching/repositories/applications.repository.js';
import { ApplicationsService } from '../../dist/core/matching/services/applications.service.js';
import type { MatchingService } from '../../dist/core/matching/services/matching.service.js';
import type {
  Application,
  ApplicationRecord,
  ApplicationStatus,
  NewApplication,
} from '../../dist/core/matching/types/application.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { EVENT_ID } from './fixtures/catalog.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';

const APPLICATION_ID = 'a9000000-0000-4000-8000-000000000001';
const SESSION_ID = '5e000000-0000-4000-8000-000000000001';
const LATER_SESSION_ID = '5e000000-0000-4000-8000-000000000002';

/** Ten days after NOW, so the first round, a week before, is still to come. */
const SESSION: EventSession = {
  id: SESSION_ID,
  eventId: EVENT_ID,
  startsAt: '2026-10-25T17:00:00.000Z',
  cutoffAt: '2026-10-25T16:00:00.000Z',
  status: 'scheduled',
};
const LATER_SESSION: EventSession = {
  ...SESSION,
  id: LATER_SESSION_ID,
  startsAt: '2026-10-28T17:00:00.000Z',
  cutoffAt: '2026-10-28T16:00:00.000Z',
};

const TX = {} as Transaction;

const INPUT: NewApplication = {
  eventId: EVENT_ID,
  desiredCompany: 'company',
  afterEventPlans: ['walk'],
  preferredGender: 'female',
  ageMin: 20,
  ageMax: null,
};

function anApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: APPLICATION_ID,
    userId: ACCOUNT_ID,
    eventId: EVENT_ID,
    sessionIds: [SESSION_ID],
    desiredCompany: 'company',
    afterEventPlans: ['walk'],
    preferredGender: 'any',
    ageMin: 18,
    ageMax: null,
    status: 'in_pool',
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function makeService({ complete = true, existing = [] as Application[], stored = anApplication() } = {}) {
  const applicationsRepository = {
    create: mock.fn<(record: ApplicationRecord, tx?: Transaction) => Promise<Application>>((record) =>
      Promise.resolve(anApplication(record)),
    ),
    findById: mock.fn((): Promise<Application | undefined> => Promise.resolve(stored)),
    findByUserAndEvent: mock.fn(() => Promise.resolve(existing)),
    findByUserWithStatus: mock.fn<(userId: string, statuses: ApplicationStatus[]) => Promise<Application[]>>(() =>
      Promise.resolve(existing),
    ),
  };
  const eventSessionsService = {
    open: mock.fn<(eventId: string, days?: string[], tx?: Transaction) => Promise<OpenedSession[]>>(() =>
      Promise.resolve([{ ...SESSION, created: true }]),
    ),
    getByIds: mock.fn(() =>
      Promise.resolve(
        new Map([
          [SESSION_ID, SESSION],
          [LATER_SESSION_ID, LATER_SESSION],
        ]),
      ),
    ),
  };
  const profilesService = { isComplete: mock.fn(() => Promise.resolve(complete)) };
  const matchingService = {
    scheduleRounds: mock.fn<(sessions: OpenedSession[], tx: Transaction) => Promise<void>>(() => Promise.resolve()),
    matchOnApply: mock.fn<(application: Application) => Promise<boolean>>(() => Promise.resolve(false)),
    withdraw: mock.fn<(application: Application, from: ApplicationStatus[]) => Promise<Application | undefined>>(() =>
      Promise.resolve(anApplication({ status: 'withdrawn' })),
    ),
  };
  const transactions = {
    run: mock.fn((work: (tx: Transaction) => Promise<unknown>) => work(TX)),
  };
  const service = new ApplicationsService(
    applicationsRepository as unknown as ApplicationsRepository,
    eventSessionsService as unknown as EventSessionsService,
    profilesService as unknown as ProfilesService,
    matchingService as unknown as MatchingService,
    transactions as unknown as TransactionRunner,
  );
  return { service, applicationsRepository, eventSessionsService, matchingService };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('ApplicationsService.apply', () => {
  useFixedClock();

  test('puts the user in the pool of the event for their days, with their answers and the next round', async () => {
    const { service, applicationsRepository, eventSessionsService } = makeService();
    eventSessionsService.open.mock.mockImplementation(() =>
      Promise.resolve([
        { ...SESSION, created: true },
        { ...LATER_SESSION, created: false },
      ]),
    );

    const application = await service.apply(ACCOUNT_ID, { ...INPUT, dates: ['2026-10-25', '2026-10-28'] });

    assert.deepEqual(eventSessionsService.open.mock.calls[0]?.arguments, [EVENT_ID, ['2026-10-25', '2026-10-28'], TX]);
    assert.deepEqual(applicationsRepository.create.mock.calls[0]?.arguments[0], {
      userId: ACCOUNT_ID,
      eventId: EVENT_ID,
      sessionIds: [SESSION_ID, LATER_SESSION_ID],
      desiredCompany: 'company',
      afterEventPlans: ['walk'],
      preferredGender: 'female',
      ageMin: 20,
      ageMax: null,
    });
    assert.equal(application.eventId, EVENT_ID);
    assert.deepEqual(application.sessions, [
      { startsAt: SESSION.startsAt, cutoffAt: SESSION.cutoffAt },
      { startsAt: LATER_SESSION.startsAt, cutoffAt: LATER_SESSION.cutoffAt },
    ]);
    // The application can be matched until the last day's cutoff; the next round is the soonest of either day.
    assert.equal(application.cutoffAt, LATER_SESSION.cutoffAt);
    assert.equal(application.nextRoundAt, '2026-10-18T17:00:00.000Z');
  });

  test('refuses an incomplete profile before it opens a session', async () => {
    const { service, eventSessionsService } = makeService({ complete: false });

    await assert.rejects(service.apply(ACCOUNT_ID, INPUT), isDomainError('PROFILE_INCOMPLETE'));
    assert.equal(eventSessionsService.open.mock.callCount(), 0);
  });

  for (const status of ['in_pool', 'paused', 'paired'] as const) {
    test(`refuses a second application while one is ${status}`, async () => {
      const { service, applicationsRepository, eventSessionsService } = makeService({
        existing: [anApplication({ status })],
      });

      await assert.rejects(service.apply(ACCOUNT_ID, INPUT), isDomainError('ALREADY_APPLIED'));
      assert.equal(applicationsRepository.create.mock.callCount(), 0);
      assert.equal(eventSessionsService.open.mock.callCount(), 0, 'no empty session is created');
    });
  }

  test('opens the sessions, saves the application and plans the rounds of new sessions in one transaction', async () => {
    const { service, applicationsRepository, matchingService } = makeService();

    await service.apply(ACCOUNT_ID, INPUT);

    assert.equal(applicationsRepository.create.mock.calls[0]?.arguments[1], TX);
    assert.deepEqual(matchingService.scheduleRounds.mock.calls[0]?.arguments, [[{ ...SESSION, created: true }], TX]);
  });

  // FR-017, matching.md rule 1
  test('answers paired with no next round when the application is matched at once', async () => {
    const { service, matchingService } = makeService();
    matchingService.matchOnApply.mock.mockImplementation(() => Promise.resolve(true));

    const application = await service.apply(ACCOUNT_ID, INPUT);

    assert.equal(matchingService.matchOnApply.mock.calls[0]?.arguments[0]?.id, APPLICATION_ID);
    assert.equal(application.status, 'paired');
    assert.equal(application.nextRoundAt, null);
  });

  test('keeps the application in the pool when the instant match fails', async () => {
    const { service, matchingService } = makeService();
    matchingService.matchOnApply.mock.mockImplementation(() => Promise.reject(new Error('lock timeout')));

    const application = await service.apply(ACCOUNT_ID, INPUT);

    assert.equal(application.status, 'in_pool');
    assert.equal(application.nextRoundAt, '2026-10-18T17:00:00.000Z');
  });

  test('accepts a new application after a withdrawn one', async () => {
    const { service } = makeService({ existing: [anApplication({ status: 'withdrawn' })] });

    const application = await service.apply(ACCOUNT_ID, INPUT);

    assert.equal(application.status, 'in_pool');
  });
});

describe('ApplicationsService.listMine', () => {
  useFixedClock();

  test('asks for the active applications and puts the soonest session first', async () => {
    const later = anApplication({ id: 'later', sessionIds: [LATER_SESSION_ID] });
    const sooner = anApplication({ id: 'sooner', status: 'paused' });
    const { service, applicationsRepository } = makeService({ existing: [later, sooner] });

    const applications = await service.listMine(ACCOUNT_ID);

    assert.deepEqual(applicationsRepository.findByUserWithStatus.mock.calls[0]?.arguments, [
      ACCOUNT_ID,
      ['in_pool', 'paired', 'paused'],
    ]);
    assert.deepEqual(
      applications.map(({ id }) => id),
      ['sooner', 'later'],
    );
    assert.equal(applications[0]?.nextRoundAt, null, 'a paused application waits for no round');
    assert.equal(applications[1]?.nextRoundAt, '2026-10-21T17:00:00.000Z');
  });

  test('fails as a data error when a session is missing', async () => {
    const { service } = makeService({ existing: [anApplication({ sessionIds: ['gone'] })] });

    await assert.rejects(
      service.listMine(ACCOUNT_ID),
      (error: unknown) => error instanceof Error && !(error instanceof DomainError),
    );
  });
});

describe('ApplicationsService.withdraw', () => {
  useFixedClock();

  for (const status of ['in_pool', 'paused', 'paired'] as const) {
    test(`withdraws an application that is ${status}`, async () => {
      const stored = anApplication({ status });
      const { service, matchingService } = makeService({ stored });

      const application = await service.withdraw(ACCOUNT_ID, APPLICATION_ID);

      assert.deepEqual(matchingService.withdraw.mock.calls[0]?.arguments, [stored, ['in_pool', 'paused', 'paired']]);
      assert.equal(application.status, 'withdrawn');
      assert.equal(application.nextRoundAt, null);
    });
  }

  test('changes nothing for a withdrawn application', async () => {
    const { service, matchingService } = makeService({ stored: anApplication({ status: 'withdrawn' }) });

    const application = await service.withdraw(ACCOUNT_ID, APPLICATION_ID);

    assert.equal(application.status, 'withdrawn');
    assert.equal(matchingService.withdraw.mock.callCount(), 0);
  });

  for (const status of ['removed', 'no_match', 'cancelled'] as const) {
    test(`refuses an application that is ${status}`, async () => {
      const { service, matchingService } = makeService({ stored: anApplication({ status }) });

      await assert.rejects(service.withdraw(ACCOUNT_ID, APPLICATION_ID), isDomainError('CONFLICT'));
      assert.equal(matchingService.withdraw.mock.callCount(), 0);
    });
  }

  test('refuses an application whose status changed meanwhile', async () => {
    const { service, matchingService } = makeService();
    matchingService.withdraw.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.withdraw(ACCOUNT_ID, APPLICATION_ID), isDomainError('CONFLICT'));
  });

  test('reports someone else’s application as missing', async () => {
    const { service } = makeService({ stored: anApplication({ userId: OTHER_ACCOUNT_ID }) });

    await assert.rejects(service.withdraw(ACCOUNT_ID, APPLICATION_ID), isDomainError('NOT_FOUND'));
  });
});

describe('ApplicationsService.getOwn', () => {
  useFixedClock();

  test('gives the caller’s application with its session', async () => {
    const { service } = makeService();

    const application = await service.getOwn(ACCOUNT_ID, APPLICATION_ID);

    assert.equal(application.sessions[0]?.startsAt, SESSION.startsAt);
  });

  test('reports an application that does not exist as missing', async () => {
    const { service, applicationsRepository } = makeService();
    applicationsRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.getOwn(ACCOUNT_ID, APPLICATION_ID), isDomainError('NOT_FOUND'));
  });
});
