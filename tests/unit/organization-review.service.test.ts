// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { OrganizationsService } from '../../dist/core/catalog/services/organizations.service.js';
import type { Organization } from '../../dist/core/catalog/types/organization.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { AuditLogRepository } from '../../dist/core/moderation/repositories/audit-log.repository.js';
import { OrganizationReviewService } from '../../dist/core/moderation/services/organization-review.service.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { AuditEntry } from '../../dist/core/moderation/types/report.js';
import type { ProfileSummary } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization } from './fixtures/catalog.ts';

const ADMIN_ID = 'a0000000-0000-4000-8000-000000000009';
const PENDING = anOrganization({ verificationStatus: 'pending', verifiedAt: null });

/** Every dependency as a mock: ACCOUNT_ID has a pending request and a profile. */
function makeService() {
  const organizationsService = {
    find: mock.fn((): Promise<Organization | undefined> => Promise.resolve(PENDING)),
    getOwn: mock.fn(() => Promise.resolve(anOrganization())),
    listRequests: mock.fn(() => Promise.resolve({ items: [PENDING], page: { limit: 20, offset: 0, hasMore: false } })),
    decide: mock.fn(() => Promise.resolve(true)),
  };
  const profilesService = {
    getSummaries: mock.fn((): Promise<Map<string, ProfileSummary>> =>
      Promise.resolve(new Map([[ACCOUNT_ID, { accountId: ACCOUNT_ID, username: 'natalka', displayName: 'Natalka' }]])),
    ),
  };
  const auditLogRepository = { record: mock.fn<(entry: AuditEntry) => Promise<void>>(() => Promise.resolve()) };
  const service = new OrganizationReviewService(
    organizationsService as unknown as OrganizationsService,
    profilesService as unknown as ProfilesService,
    auditLogRepository as unknown as AuditLogRepository,
  );
  return { service, organizationsService, auditLogRepository };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('OrganizationReviewService.list', () => {
  test('shows each request with the account that sent it', async () => {
    const { service } = makeService();

    const { items } = await service.list({ limit: 20, offset: 0 });

    assert.deepEqual(items, [{ ...PENDING, account: { id: ACCOUNT_ID, username: 'natalka', displayName: 'Natalka' } }]);
  });
});

// FR-003, SEC-004
describe('OrganizationReviewService.decide', () => {
  for (const [decision, action] of [
    ['verified', 'organization.approve'],
    ['rejected', 'organization.reject'],
  ] as const) {
    test(`records the decision ${decision} with the administrator, and audits it`, async () => {
      const { service, organizationsService, auditLogRepository } = makeService();

      await service.decide(ACCOUNT_ID, decision, ADMIN_ID);

      assert.deepEqual(organizationsService.decide.mock.calls[0]?.arguments, [ACCOUNT_ID, decision, ADMIN_ID]);
      assert.deepEqual(auditLogRepository.record.mock.calls[0]?.arguments, [
        { actorId: ADMIN_ID, action, targetType: 'organization', targetId: ACCOUNT_ID, result: decision },
      ]);
    });
  }

  test('refuses an administrator’s own request, decides nothing and audits the refusal', async () => {
    const { service, organizationsService, auditLogRepository } = makeService();

    await assert.rejects(
      service.decide(ACCOUNT_ID, 'verified', ACCOUNT_ID),
      isDomainError('CANNOT_DECIDE_OWN_REQUEST'),
    );
    assert.equal(organizationsService.decide.mock.callCount(), 0);
    assert.equal(auditLogRepository.record.mock.calls[0]?.arguments[0].result, 'refused: own request');
  });

  test('refuses a request that is not pending with CONFLICT and audits the refusal', async () => {
    const { service, organizationsService, auditLogRepository } = makeService();
    organizationsService.decide.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.decide(ACCOUNT_ID, 'rejected', ADMIN_ID), isDomainError('CONFLICT'));
    assert.equal(auditLogRepository.record.mock.calls[0]?.arguments[0].result, 'refused: not pending');
  });

  test('answers NOT_FOUND to an account without a request', async () => {
    const { service, organizationsService } = makeService();
    organizationsService.find.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.decide(ACCOUNT_ID, 'verified', ADMIN_ID), isDomainError('NOT_FOUND'));
    assert.equal(organizationsService.decide.mock.callCount(), 0);
  });
});
