// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { OrganizationsRepository } from '../../dist/core/catalog/repositories/organizations.repository.js';
import { OrganizationsService } from '../../dist/core/catalog/services/organizations.service.js';
import type { Organization } from '../../dist/core/catalog/types/organization.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { ImagesService } from '../../dist/core/images/services/images.service.js';
import type { ImageRef } from '../../dist/core/images/types/image.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization } from './fixtures/catalog.ts';
import { fakeImages } from './fixtures/images.ts';

const REQUEST = { name: 'Natalka Park', description: 'Open-air cinema.', officialLink: 'https://natalka.park' };
const PENDING = anOrganization({ ...REQUEST, verificationStatus: 'pending', verifiedAt: null });
const OLD_LOGO: ImageRef = { id: 'a0000000-0000-4000-8000-000000000021', width: 512, height: 512, crop: null };
const LOGO: ImageRef = { ...OLD_LOGO, id: 'a0000000-0000-4000-8000-000000000022' };
const UPLOAD = {
  content: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
  crop: { left: 0, top: 0, width: 1, height: 1 },
};

const VERIFIED = anOrganization({ verificationStatus: 'verified' });

/** The repository as a mock: the account has no organization yet, or `stored`. */
function makeService({ stored }: { stored?: Organization } = {}) {
  const organizationsRepository = {
    findByAccountId: mock.fn((): Promise<Organization | undefined> => Promise.resolve(stored)),
    create: mock.fn((): Promise<Organization | undefined> => Promise.resolve(PENDING)),
    resubmit: mock.fn((): Promise<Organization | undefined> => Promise.resolve(PENDING)),
    findPage: mock.fn(),
    decide: mock.fn(() => Promise.resolve(true)),
    setLogo: mock.fn((accountId: string, logoId: string | null) =>
      Promise.resolve(anOrganization({ accountId, logoId })),
    ),
    setInstagram: mock.fn((accountId: string, instagram: string | null) =>
      Promise.resolve({ ...(stored ?? anOrganization()), accountId, instagram }),
    ),
  };
  const { imagesService, transactions, tx } = fakeImages([OLD_LOGO, LOGO], LOGO);
  const service = new OrganizationsService(
    organizationsRepository as unknown as OrganizationsRepository,
    imagesService as unknown as ImagesService,
    transactions as unknown as TransactionRunner,
  );
  return { service, organizationsRepository, imagesService, tx };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

// Instagram is a public link, not verified data: it never sends the organization back to review.
describe('OrganizationsService.setInstagram', () => {
  for (const typed of [
    'natalka.park',
    '@natalka.park',
    'https://www.instagram.com/natalka.park/',
    ' instagram.com/natalka.park ',
  ]) {
    test(`keeps "${typed}" as the bare username`, async () => {
      const { service, organizationsRepository } = makeService({ stored: VERIFIED });

      await service.setInstagram(ACCOUNT_ID, typed);

      assert.deepEqual(organizationsRepository.setInstagram.mock.calls[0]?.arguments, [ACCOUNT_ID, 'natalka.park']);
    });
  }

  for (const [title, typed] of [
    ['null', null],
    ['an empty field', '  '],
  ] as const) {
    test(`clears it with ${title}`, async () => {
      const { service, organizationsRepository } = makeService({ stored: VERIFIED });

      await service.setInstagram(ACCOUNT_ID, typed);

      assert.deepEqual(organizationsRepository.setInstagram.mock.calls[0]?.arguments, [ACCOUNT_ID, null]);
    });
  }

  for (const verificationStatus of ['pending', 'verified', 'rejected', 'revoked'] as const) {
    test(`leaves a ${verificationStatus} organization ${verificationStatus}`, async () => {
      const stored = anOrganization({ verificationStatus });
      const { service, organizationsRepository } = makeService({ stored });

      const saved = await service.setInstagram(ACCOUNT_ID, '@natalka.park');

      assert.equal(saved.verificationStatus, verificationStatus);
      assert.equal(organizationsRepository.resubmit.mock.callCount(), 0);
      assert.equal(organizationsRepository.create.mock.callCount(), 0);
    });
  }

  for (const typed of ['.natalka', 'a'.repeat(31), 'na talka', 'https://instagram.com/p/abc', 'https://t.me/natalka']) {
    test(`refuses "${typed}" with INVALID_SOCIAL_HANDLE`, async () => {
      const { service, organizationsRepository } = makeService({ stored: VERIFIED });

      await assert.rejects(
        service.setInstagram(ACCOUNT_ID, typed),
        (error: unknown) =>
          error instanceof DomainError && error.code === 'INVALID_SOCIAL_HANDLE' && error.field === 'instagram',
      );
      assert.equal(organizationsRepository.setInstagram.mock.callCount(), 0);
    });
  }

  test('answers NOT_FOUND for an account without an organization request', async () => {
    const { service, organizationsRepository } = makeService();

    await assert.rejects(service.setInstagram(ACCOUNT_ID, '@natalka.park'), isDomainError('NOT_FOUND'));
    assert.equal(organizationsRepository.setInstagram.mock.callCount(), 0);
  });
});

describe('OrganizationsService.getPublic', () => {
  test('returns a verified organization without its account or verification details', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(anOrganization({ instagram: 'natalka.park', logoId: LOGO.id })),
    );

    assert.deepEqual(await service.getPublic(ACCOUNT_ID), {
      id: ACCOUNT_ID,
      name: 'Natalka Park',
      description: 'Open-air cinema and concerts by the Dnipro.',
      officialLink: 'https://natalka.park',
      instagram: 'natalka.park',
      logo: LOGO,
    });
  });

  for (const verificationStatus of ['pending', 'rejected', 'revoked'] as const) {
    test(`answers NOT_FOUND for a ${verificationStatus} organization`, async () => {
      const { service, organizationsRepository } = makeService();
      organizationsRepository.findByAccountId.mock.mockImplementation(() =>
        Promise.resolve(anOrganization({ verificationStatus })),
      );

      await assert.rejects(service.getPublic(ACCOUNT_ID), isDomainError('NOT_FOUND'));
    });
  }
});

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

    assert.deepEqual(await service.request(ACCOUNT_ID, REQUEST), { ...PENDING, logo: null });
    assert.deepEqual(organizationsRepository.create.mock.calls[0]?.arguments, [ACCOUNT_ID, REQUEST]);
    assert.equal(organizationsRepository.resubmit.mock.callCount(), 0);
  });

  test('sends a rejected request again', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(anOrganization({ verificationStatus: 'rejected', verifiedAt: null })),
    );

    assert.deepEqual(await service.request(ACCOUNT_ID, REQUEST), { ...PENDING, logo: null });
    assert.deepEqual(organizationsRepository.resubmit.mock.calls[0]?.arguments, [ACCOUNT_ID, REQUEST]);
    assert.equal(organizationsRepository.create.mock.callCount(), 0);
  });

  test('replaces a first request that a parallel one created in between', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.create.mock.mockImplementation(() => Promise.resolve(undefined));

    assert.deepEqual(await service.request(ACCOUNT_ID, REQUEST), { ...PENDING, logo: null });
    assert.equal(organizationsRepository.resubmit.mock.callCount(), 1);
  });

  test('refuses a verified organization with CONFLICT', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(anOrganization()));
    organizationsRepository.resubmit.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.request(ACCOUNT_ID, REQUEST), isDomainError('CONFLICT'));
  });
});

// FR-003: the organization's logo, in any verification status.
describe('OrganizationsService.setLogo', () => {
  test('cuts the upload as a logo, points the organization at it and deletes the old one in one transaction', async () => {
    const { service, organizationsRepository, imagesService, tx } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(anOrganization({ ...PENDING, logoId: OLD_LOGO.id })),
    );

    const organization = await service.setLogo(ACCOUNT_ID, UPLOAD);

    assert.deepEqual(imagesService.prepare.mock.calls[0]?.arguments, ['organizationLogo', UPLOAD]);
    assert.deepEqual(organizationsRepository.setLogo.mock.calls[0]?.arguments, [ACCOUNT_ID, LOGO.id, tx]);
    assert.deepEqual(imagesService.remove.mock.calls[0]?.arguments, [[OLD_LOGO.id], tx]);
    assert.deepEqual(organization.logo, LOGO);
  });

  test('answers NOT_FOUND before the first request, without reading the picture', async () => {
    const { service, imagesService } = makeService();

    await assert.rejects(service.setLogo(ACCOUNT_ID, UPLOAD), isDomainError('NOT_FOUND'));
    assert.equal(imagesService.prepare.mock.callCount(), 0);
  });
});

describe('OrganizationsService.removeLogo', () => {
  test('clears the logo and deletes its picture', async () => {
    const { service, organizationsRepository, imagesService, tx } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(anOrganization({ logoId: OLD_LOGO.id })),
    );

    const organization = await service.removeLogo(ACCOUNT_ID);

    assert.deepEqual(organizationsRepository.setLogo.mock.calls[0]?.arguments, [ACCOUNT_ID, null, tx]);
    assert.deepEqual(imagesService.remove.mock.calls[0]?.arguments, [[OLD_LOGO.id], tx]);
    assert.equal(organization.logo, null);
  });
});
