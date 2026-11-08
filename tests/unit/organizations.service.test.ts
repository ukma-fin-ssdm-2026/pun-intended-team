// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { OrganizationsRepository } from '../../dist/core/catalog/repositories/organizations.repository.js';
import { OrganizationsService } from '../../dist/core/catalog/services/organizations.service.js';
import type { Organization } from '../../dist/core/catalog/types/organization.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization } from './fixtures/catalog.ts';

const REQUEST = { name: 'Natalka Park', description: 'Open-air cinema.', officialLink: 'https://natalka.park' };
const PENDING = anOrganization({ ...REQUEST, verificationStatus: 'pending', verifiedAt: null });

/** The repository as a mock: the account has no organization yet. */
function makeService() {
  const organizationsRepository = {
    findByAccountId: mock.fn((): Promise<Organization | undefined> => Promise.resolve(undefined)),
    create: mock.fn((): Promise<Organization | undefined> => Promise.resolve(PENDING)),
    resubmit: mock.fn((): Promise<Organization | undefined> => Promise.resolve(PENDING)),
    findPage: mock.fn(),
    decide: mock.fn(() => Promise.resolve(true)),
  };
  const service = new OrganizationsService(organizationsRepository as unknown as OrganizationsRepository);
  return { service, organizationsRepository };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('OrganizationsService.getOwn', () => {
  test('answers NOT_FOUND before the first request', async () => {
    const { service } = makeService();

    await assert.rejects(service.getOwn(ACCOUNT_ID), isDomainError('NOT_FOUND'));
  });
});

// FR-003
describe('OrganizationsService.request', () => {
  test('saves the first request as pending', async () => {
    const { service, organizationsRepository } = makeService();

    assert.deepEqual(await service.request(ACCOUNT_ID, REQUEST), PENDING);
    assert.deepEqual(organizationsRepository.create.mock.calls[0]?.arguments, [ACCOUNT_ID, REQUEST]);
    assert.equal(organizationsRepository.resubmit.mock.callCount(), 0);
  });

  test('sends a rejected request again', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(anOrganization({ verificationStatus: 'rejected', verifiedAt: null })),
    );

    assert.deepEqual(await service.request(ACCOUNT_ID, REQUEST), PENDING);
    assert.deepEqual(organizationsRepository.resubmit.mock.calls[0]?.arguments, [ACCOUNT_ID, REQUEST]);
    assert.equal(organizationsRepository.create.mock.callCount(), 0);
  });

  test('replaces a first request that a parallel one created in between', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.create.mock.mockImplementation(() => Promise.resolve(undefined));

    assert.deepEqual(await service.request(ACCOUNT_ID, REQUEST), PENDING);
    assert.equal(organizationsRepository.resubmit.mock.callCount(), 1);
  });

  test('refuses a verified organization with CONFLICT', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(anOrganization()));
    organizationsRepository.resubmit.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.request(ACCOUNT_ID, REQUEST), isDomainError('CONFLICT'));
  });
});
