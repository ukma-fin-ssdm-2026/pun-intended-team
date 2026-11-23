// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { VenuesService } from '../../dist/core/catalog/services/venues.service.js';
import type { OrganizationsRepository } from '../../dist/core/catalog/repositories/organizations.repository.js';
import type { VenuesRepository } from '../../dist/core/catalog/repositories/venues.repository.js';
import type { Organization } from '../../dist/core/catalog/types/organization.js';
import type { NewVenue, Venue } from '../../dist/core/catalog/types/venue.js';
import type { Page, PageRequest } from '../../dist/core/common/page.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization, aVenue, VENUE_ID } from './fixtures/catalog.ts';

const PAGE: PageRequest = { limit: 20, offset: 0 };

function aNewVenue(overrides: Partial<NewVenue> = {}): NewVenue {
  const { name, address, location } = aVenue();
  return { name, address, location, ...overrides };
}

function makeService() {
  const venuesRepository = {
    findById: mock.fn((): Promise<Venue | undefined> => Promise.resolve(aVenue())),
    findByOrganization: mock.fn((_organizationId: string, page: PageRequest): Promise<Page<Venue>> =>
      Promise.resolve({ items: [aVenue()], page: { ...page, hasMore: false } }),
    ),
    create: mock.fn((organizationId: string, venue: NewVenue): Promise<Venue> =>
      Promise.resolve(aVenue({ ...venue, organizationId })),
    ),
  };
  const organizationsRepository = {
    findByAccountId: mock.fn((): Promise<Organization | undefined> => Promise.resolve(anOrganization())),
  };

  const service = new VenuesService(
    venuesRepository as unknown as VenuesRepository,
    organizationsRepository as unknown as OrganizationsRepository,
  );
  return { service, venuesRepository, organizationsRepository };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('VenuesService.listOwn', () => {
  test('asks for the caller’s venues', async () => {
    const { service, venuesRepository } = makeService();

    await service.listOwn(ACCOUNT_ID, PAGE);

    assert.deepEqual(venuesRepository.findByOrganization.mock.calls[0]?.arguments, [ACCOUNT_ID, PAGE]);
  });
});

describe('VenuesService.getOwn', () => {
  test('returns the caller’s venue', async () => {
    const { service } = makeService();

    const venue = await service.getOwn(ACCOUNT_ID, VENUE_ID);

    assert.equal(venue.id, VENUE_ID);
  });

  const hiddenCases = [
    { title: 'another organization’s venue', venue: aVenue({ organizationId: OTHER_ACCOUNT_ID }) },
    { title: 'an imported venue', venue: aVenue({ source: 'import', organizationId: null }) },
    { title: 'a missing venue', venue: undefined },
  ];
  for (const { title, venue } of hiddenCases) {
    test(`answers NOT_FOUND for ${title}`, async () => {
      const { service, venuesRepository } = makeService();
      venuesRepository.findById.mock.mockImplementation(() => Promise.resolve(venue));

      await assert.rejects(service.getOwn(ACCOUNT_ID, VENUE_ID), isDomainError('NOT_FOUND'));
    });
  }
});

// FR-009: an organization publishes at its own venues.
describe('VenuesService.create', () => {
  test('saves the venue as the organization’s own', async () => {
    const { service, venuesRepository } = makeService();
    const input = aNewVenue();

    await service.create(ACCOUNT_ID, input);

    assert.deepEqual(venuesRepository.create.mock.calls[0]?.arguments, [ACCOUNT_ID, input]);
  });

  test('rejects an organization that is not verified yet', async () => {
    const { service, venuesRepository, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(anOrganization({ verificationStatus: 'pending' })),
    );

    await assert.rejects(service.create(ACCOUNT_ID, aNewVenue()), isDomainError('ORGANIZATION_NOT_VERIFIED'));
    assert.equal(venuesRepository.create.mock.callCount(), 0);
  });

  test('rejects an account that is not an organization', async () => {
    const { service, organizationsRepository } = makeService();
    organizationsRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.create(ACCOUNT_ID, aNewVenue()), isDomainError('ORGANIZATION_NOT_VERIFIED'));
  });

  test('rejects a point outside Kyiv', async () => {
    const { service, venuesRepository } = makeService();
    const lviv = { lat: 49.8419, lng: 24.0315 };

    await assert.rejects(
      service.create(ACCOUNT_ID, aNewVenue({ location: lviv })),
      isDomainError('VENUE_OUTSIDE_CITY'),
    );
    assert.equal(venuesRepository.create.mock.callCount(), 0);
  });
});
