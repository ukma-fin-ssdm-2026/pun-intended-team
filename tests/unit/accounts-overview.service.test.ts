// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { AccountsOverviewService } from '../../dist/core/admin/services/accounts-overview.service.js';
import type { OrganizationsService } from '../../dist/core/catalog/services/organizations.service.js';
import type { Organization } from '../../dist/core/catalog/types/organization.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { addDays, kyivDate } from '../../dist/core/common/kyiv-time.js';
import type { Page, PageRequest } from '../../dist/core/common/page.js';
import type { AccountsService } from '../../dist/core/identity/services/accounts.service.js';
import type { AccountFilter, AccountOverview } from '../../dist/core/identity/types/account.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { ProfileSummary, PublicProfile } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization } from './fixtures/catalog.ts';

const PAGE: PageRequest = { limit: 20, offset: 0 };

// Born 30 years ago today, so the age does not depend on the day the test runs.
const thirtyYearsAgo = () => {
  const [year, rest] = [Number(kyivDate().slice(0, 4)) - 30, kyivDate().slice(4)];
  return `${year}${rest === '-02-29' ? '-02-28' : rest}`;
};

function anAccount(overrides: Partial<AccountOverview> = {}): AccountOverview {
  return {
    id: ACCOUNT_ID,
    role: 'user',
    status: 'active',
    signInMethods: ['google'],
    dateOfBirth: thirtyYearsAgo(),
    createdAt: '2026-10-12T09:30:00.000Z',
    ...overrides,
  };
}

/** ACCOUNT_ID has a profile and a verified organization; OTHER_ACCOUNT_ID is pending, with neither. */
function makeService() {
  const accountsService = {
    listOverviews: mock.fn((_filter: AccountFilter, page: PageRequest): Promise<Page<AccountOverview>> =>
      Promise.resolve({
        items: [anAccount(), anAccount({ id: OTHER_ACCOUNT_ID, status: 'pending', dateOfBirth: null })],
        page: { ...page, hasMore: false },
      }),
    ),
    findOverview: mock.fn((): Promise<AccountOverview | undefined> => Promise.resolve(anAccount())),
  };
  const profilesService = {
    searchAccountIds: mock.fn((): Promise<string[]> => Promise.resolve([ACCOUNT_ID])),
    getSummaries: mock.fn((): Promise<Map<string, ProfileSummary>> =>
      Promise.resolve(
        new Map([[ACCOUNT_ID, { accountId: ACCOUNT_ID, username: 'olena_k', displayName: 'Olena', photoId: null }]]),
      ),
    ),
    getPublicProfiles: mock.fn((): Promise<Map<string, PublicProfile>> => Promise.resolve(new Map())),
  };
  const organizationsService = {
    findMany: mock.fn((): Promise<Map<string, Organization>> =>
      Promise.resolve(new Map([[ACCOUNT_ID, anOrganization()]])),
    ),
    find: mock.fn((): Promise<Organization | undefined> => Promise.resolve(undefined)),
  };
  const service = new AccountsOverviewService(
    accountsService as unknown as AccountsService,
    profilesService as unknown as ProfilesService,
    organizationsService as unknown as OrganizationsService,
  );
  return { service, accountsService, profilesService, organizationsService };
}

describe('AccountsOverviewService.list', () => {
  test('adds the profile, the organization and the age, and never the date of birth', async () => {
    const { service } = makeService();

    const { items } = await service.list({}, PAGE);

    assert.deepEqual(items, [
      {
        id: ACCOUNT_ID,
        role: 'user',
        status: 'active',
        signInMethods: ['google'],
        age: 30,
        createdAt: '2026-10-12T09:30:00.000Z',
        profile: { username: 'olena_k', displayName: 'Olena' },
        organization: { name: anOrganization().name, verificationStatus: 'verified' },
      },
      {
        id: OTHER_ACCOUNT_ID,
        role: 'user',
        status: 'pending',
        signInMethods: ['google'],
        age: null,
        createdAt: '2026-10-12T09:30:00.000Z',
        profile: null,
        organization: null,
      },
    ]);
  });

  test('counts the age in whole years: a day before the birthday is a year less', async () => {
    const { service, accountsService } = makeService();
    const tomorrowThirtyYearsAgo = `${Number(addDays(kyivDate(), 1).slice(0, 4)) - 30}${addDays(kyivDate(), 1).slice(4)}`;
    accountsService.listOverviews.mock.mockImplementation(() =>
      Promise.resolve({
        items: [anAccount({ dateOfBirth: tomorrowThirtyYearsAgo })],
        page: { ...PAGE, hasMore: false },
      }),
    );

    const { items } = await service.list({}, PAGE);

    assert.equal(items[0]?.age, 29);
  });

  test('passes the role and status on, without limiting the accounts when there is no search', async () => {
    const { service, accountsService, profilesService } = makeService();

    await service.list({ role: 'admin', status: 'active' }, PAGE);

    assert.deepEqual(accountsService.listOverviews.mock.calls[0]?.arguments, [
      { role: 'admin', status: 'active', ids: undefined },
      PAGE,
    ]);
    assert.equal(profilesService.searchAccountIds.mock.callCount(), 0);
  });

  test('searches the profiles for text and lists only the accounts found', async () => {
    const { service, accountsService, profilesService } = makeService();

    await service.list({ search: 'olen' }, PAGE);

    assert.equal(profilesService.searchAccountIds.mock.calls[0]?.arguments[0], 'olen');
    assert.deepEqual(accountsService.listOverviews.mock.calls[0]?.arguments[0], {
      role: undefined,
      status: undefined,
      ids: [ACCOUNT_ID],
    });
  });

  test('takes a search that is an account id as that account, without searching the profiles', async () => {
    const { service, accountsService, profilesService } = makeService();

    await service.list({ search: ACCOUNT_ID.toUpperCase() }, PAGE);

    assert.equal(profilesService.searchAccountIds.mock.callCount(), 0);
    assert.deepEqual(accountsService.listOverviews.mock.calls[0]?.arguments[0]?.ids, [ACCOUNT_ID]);
  });

  test('gives an empty page when no profile matches the search', async () => {
    const { service, accountsService, profilesService } = makeService();
    profilesService.searchAccountIds.mock.mockImplementation(() => Promise.resolve([]));

    const result = await service.list({ search: 'nobody' }, PAGE);

    assert.deepEqual(result, { items: [], page: { ...PAGE, hasMore: false } });
    assert.equal(accountsService.listOverviews.mock.callCount(), 0);
  });
});

describe('AccountsOverviewService.get', () => {
  test('gives the account with its public profile and its organization request', async () => {
    const { service, profilesService, organizationsService } = makeService();
    const profile = { accountId: ACCOUNT_ID, username: 'olena_k' } as PublicProfile;
    profilesService.getPublicProfiles.mock.mockImplementation(() => Promise.resolve(new Map([[ACCOUNT_ID, profile]])));
    organizationsService.find.mock.mockImplementation(() => Promise.resolve(anOrganization()));

    const account = await service.get(ACCOUNT_ID);

    assert.equal(account.age, 30);
    assert.equal('dateOfBirth' in account, false);
    assert.equal(account.profile, profile);
    assert.deepEqual(account.organization, anOrganization());
  });

  test('gives null for a missing profile and organization', async () => {
    const { service } = makeService();

    const account = await service.get(ACCOUNT_ID);

    assert.equal(account.profile, null);
    assert.equal(account.organization, null);
  });

  test('refuses an unknown account with NOT_FOUND', async () => {
    const { service, accountsService } = makeService();
    accountsService.findOverview.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(
      service.get(ACCOUNT_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'NOT_FOUND',
    );
  });
});
