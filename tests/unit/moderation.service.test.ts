// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { AccountsService } from '../../dist/core/identity/services/accounts.service.js';
import type { AuditLogRepository } from '../../dist/core/moderation/repositories/audit-log.repository.js';
import type { ReportCasesRepository } from '../../dist/core/moderation/repositories/report-cases.repository.js';
import { ModerationService } from '../../dist/core/moderation/services/moderation.service.js';
import type { ReportCaseRecord, ReportRecord } from '../../dist/core/moderation/types/report.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { ProfileSummary } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';

const ADMIN_ID = 'a0000000-0000-4000-8000-000000000009';
const CASE_ID = 'c0000000-0000-4000-8000-000000000001';

/** An open case on OTHER_ACCOUNT_ID with one report by ACCOUNT_ID. */
function aCase(overrides: Partial<ReportCaseRecord> = {}): ReportCaseRecord & { reports: ReportRecord[] } {
  return {
    id: CASE_ID,
    accountId: OTHER_ACCOUNT_ID,
    status: 'open',
    resolution: null,
    reportCount: 1,
    firstReportedAt: '2026-10-30T19:12:00.000Z',
    lastReportedAt: '2026-10-30T19:12:00.000Z',
    resolvedAt: null,
    reports: [
      {
        id: 'r0000000-0000-4000-8000-000000000001',
        reporterId: ACCOUNT_ID,
        reason: 'no_show',
        comment: null,
        reportedAt: '2026-10-30T19:12:00.000Z',
      },
    ],
    ...overrides,
  };
}

/** Every dependency of ModerationService as a mock; a test changes only what it needs. */
function makeService() {
  const reportCasesRepository = {
    addAccountReport: mock.fn(() => Promise.resolve(CASE_ID)),
    findPage: mock.fn(),
    findById: mock.fn((): Promise<ReturnType<typeof aCase> | undefined> => Promise.resolve(aCase())),
    resolve: mock.fn(() => Promise.resolve(true)),
    countOpen: mock.fn(() => Promise.resolve(2)),
  };
  const auditLogRepository = { record: mock.fn(() => Promise.resolve()) };
  const profilesService = {
    findAccountId: mock.fn((): Promise<string | undefined> => Promise.resolve(OTHER_ACCOUNT_ID)),
    getSummaries: mock.fn((): Promise<Map<string, ProfileSummary>> =>
      Promise.resolve(
        new Map([[OTHER_ACCOUNT_ID, { accountId: OTHER_ACCOUNT_ID, username: 'taras', displayName: 'Taras' }]]),
      ),
    ),
  };
  const accountsService = {
    ban: mock.fn(() => Promise.resolve()),
    findStanding: mock.fn(() => Promise.resolve({ role: 'user', status: 'active' })),
  };

  const service = new ModerationService(
    reportCasesRepository as unknown as ReportCasesRepository,
    auditLogRepository as unknown as AuditLogRepository,
    profilesService as unknown as ProfilesService,
    accountsService as unknown as AccountsService,
  );
  return { service, reportCasesRepository, auditLogRepository, profilesService, accountsService };
}

function isDomainError(code: string, field?: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code && error.field === field;
}

describe('ModerationService.report', () => {
  test('adds the report to the reported account, with an empty comment stored as none', async () => {
    const { service, reportCasesRepository } = makeService();

    await service.report(ACCOUNT_ID, { username: 'taras', reason: 'fake_profile', comment: '' });

    assert.deepEqual(reportCasesRepository.addAccountReport.mock.calls[0]?.arguments, [
      OTHER_ACCOUNT_ID,
      { reporterId: ACCOUNT_ID, reason: 'fake_profile', comment: null },
    ]);
  });

  test('records who reported whom, without the comment', async () => {
    const { service, auditLogRepository } = makeService();

    await service.report(ACCOUNT_ID, { username: 'taras', reason: 'no_show', comment: 'Private details' });

    assert.deepEqual(auditLogRepository.record.mock.calls[0]?.arguments, [
      {
        actorId: ACCOUNT_ID,
        action: 'report.create',
        targetType: 'account',
        targetId: OTHER_ACCOUNT_ID,
        result: 'created',
      },
    ]);
  });

  test('stores no report on a banned user and does not tell the reporter', async () => {
    const { service, accountsService, reportCasesRepository, auditLogRepository } = makeService();
    accountsService.findStanding.mock.mockImplementation(() => Promise.resolve({ role: 'user', status: 'banned' }));

    await service.report(ACCOUNT_ID, { username: 'taras', reason: 'other' });

    assert.equal(reportCasesRepository.addAccountReport.mock.callCount(), 0);
    assert.equal(auditLogRepository.record.mock.calls[0]?.arguments[0].result, 'ignored: account not active');
  });

  test('rejects a username no profile has and stores nothing', async () => {
    const { service, profilesService, reportCasesRepository } = makeService();
    profilesService.findAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(
      service.report(ACCOUNT_ID, { username: 'nobody', reason: 'other' }),
      isDomainError('REFERENCE_NOT_FOUND', 'username'),
    );
    assert.equal(reportCasesRepository.addAccountReport.mock.callCount(), 0);
  });

  test('rejects reporting yourself and stores nothing', async () => {
    const { service, profilesService, reportCasesRepository } = makeService();
    profilesService.findAccountId.mock.mockImplementation(() => Promise.resolve(ACCOUNT_ID));

    await assert.rejects(
      service.report(ACCOUNT_ID, { username: 'me', reason: 'other' }),
      isDomainError('CANNOT_REPORT_SELF', 'username'),
    );
    assert.equal(reportCasesRepository.addAccountReport.mock.callCount(), 0);
  });
});

describe('ModerationService.getCase', () => {
  test('shows a reporter without a profile with no username', async () => {
    const { service } = makeService();

    const found = await service.getCase(CASE_ID);

    assert.deepEqual(found.account, { id: OTHER_ACCOUNT_ID, username: 'taras', displayName: 'Taras' });
    assert.deepEqual(found.reports[0]?.reporter, { id: ACCOUNT_ID, username: null, displayName: null });
  });

  test('answers NOT_FOUND to an unknown case', async () => {
    const { service, reportCasesRepository } = makeService();
    reportCasesRepository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.getCase(CASE_ID), isDomainError('NOT_FOUND'));
  });
});

describe('ModerationService.ban', () => {
  test('resolves the case, bans the reported account and records who did it', async () => {
    const { service, reportCasesRepository, accountsService, auditLogRepository } = makeService();

    await service.ban(CASE_ID, ADMIN_ID);

    assert.deepEqual(reportCasesRepository.resolve.mock.calls[0]?.arguments.slice(0, 3), [CASE_ID, 'banned', ADMIN_ID]);
    assert.deepEqual(accountsService.ban.mock.calls[0]?.arguments, [OTHER_ACCOUNT_ID]);
    assert.deepEqual(auditLogRepository.record.mock.calls[0]?.arguments, [
      { actorId: ADMIN_ID, action: 'account.ban', targetType: 'account', targetId: OTHER_ACCOUNT_ID, result: 'banned' },
    ]);
  });

  test('bans no one when the case was dismissed in the meantime, and records the refusal', async () => {
    const { service, reportCasesRepository, accountsService, auditLogRepository } = makeService();
    reportCasesRepository.resolve.mock.mockImplementation(() => Promise.resolve(false));
    reportCasesRepository.findById.mock.mockImplementation(() =>
      Promise.resolve(aCase({ status: 'resolved', resolution: 'dismissed' })),
    );

    await assert.rejects(service.ban(CASE_ID, ADMIN_ID), isDomainError('CONFLICT'));
    assert.equal(accountsService.ban.mock.callCount(), 0);
    assert.equal(auditLogRepository.record.mock.calls[0]?.arguments[0].result, 'refused: already resolved');
  });

  test('bans again on a case already resolved as banned, so a ban that failed halfway can be retried', async () => {
    const { service, reportCasesRepository, accountsService } = makeService();
    reportCasesRepository.resolve.mock.mockImplementation(() => Promise.resolve(false));
    reportCasesRepository.findById.mock.mockImplementation(() =>
      Promise.resolve(aCase({ status: 'resolved', resolution: 'banned' })),
    );

    await service.ban(CASE_ID, ADMIN_ID);

    assert.deepEqual(accountsService.ban.mock.calls[0]?.arguments, [OTHER_ACCOUNT_ID]);
  });

  test('refuses to ban an administrator and leaves the case open', async () => {
    const { service, accountsService, reportCasesRepository } = makeService();
    accountsService.findStanding.mock.mockImplementation(() => Promise.resolve({ role: 'admin', status: 'active' }));

    await assert.rejects(service.ban(CASE_ID, ADMIN_ID), isDomainError('CONFLICT'));
    assert.equal(reportCasesRepository.resolve.mock.callCount(), 0);
    assert.equal(accountsService.ban.mock.callCount(), 0);
  });

  test('refuses a case about the administrator themselves', async () => {
    const { service, reportCasesRepository } = makeService();

    await assert.rejects(service.ban(CASE_ID, OTHER_ACCOUNT_ID), isDomainError('CONFLICT'));
    await assert.rejects(service.dismiss(CASE_ID, OTHER_ACCOUNT_ID), isDomainError('CONFLICT'));
    assert.equal(reportCasesRepository.resolve.mock.callCount(), 0);
  });
});

describe('ModerationService.dismiss', () => {
  test('resolves the case without banning anyone and records who dismissed it', async () => {
    const { service, reportCasesRepository, accountsService, auditLogRepository } = makeService();

    await service.dismiss(CASE_ID, ADMIN_ID);

    assert.equal(reportCasesRepository.resolve.mock.calls[0]?.arguments[1], 'dismissed');
    assert.equal(accountsService.ban.mock.callCount(), 0);
    assert.deepEqual(auditLogRepository.record.mock.calls[0]?.arguments, [
      {
        actorId: ADMIN_ID,
        action: 'report_case.dismiss',
        targetType: 'report_case',
        targetId: CASE_ID,
        result: 'dismissed',
      },
    ]);
  });
});
