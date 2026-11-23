// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { OrganizationsService } from '../../catalog/services/organizations.service.ts';
import { ageOn } from '../../common/age.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import type { AccountOverview } from '../../identity/types/account.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import type { AccountDetails, AccountListItem, AccountQuery } from '../types/account-overview.ts';

// A search that matches more profiles than this finds only the first of them.
const MAX_SEARCH_MATCHES = 500;

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accounts for the admin panel (FR-027); identity, profiles and catalog each give their part. */
@Injectable()
export class AccountsOverviewService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly profilesService: ProfilesService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /** Newest first. */
  async list({ search, role, status }: AccountQuery, page: PageRequest): Promise<Page<AccountListItem>> {
    const ids = search === undefined ? undefined : await this.accountIdsFor(search);
    if (ids?.length === 0) {
      return { items: [], page: { ...page, hasMore: false } };
    }
    const accounts = await this.accountsService.listOverviews({ role, status, ids }, page);
    const accountIds = accounts.items.map(({ id }) => id);
    const [summaries, organizations] = await Promise.all([
      this.profilesService.getSummaries(accountIds),
      this.organizationsService.findMany(accountIds),
    ]);
    const today = kyivDate();
    return {
      items: accounts.items.map((account) => {
        const summary = summaries.get(account.id);
        const organization = organizations.get(account.id);
        return {
          ...withAge(account, today),
          profile: summary ? { username: summary.username, displayName: summary.displayName } : null,
          organization: organization
            ? { name: organization.name, verificationStatus: organization.verificationStatus }
            : null,
        };
      }),
      page: accounts.page,
    };
  }

  async get(accountId: string): Promise<AccountDetails> {
    const account = await this.accountsService.findOverview(accountId);
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Account not found');
    }
    const [profiles, organization] = await Promise.all([
      this.profilesService.getPublicProfiles([accountId]),
      this.organizationsService.find(accountId),
    ]);
    return {
      ...withAge(account, kyivDate()),
      profile: profiles.get(accountId) ?? null,
      organization: organization ?? null,
    };
  }

  private async accountIdsFor(search: string): Promise<string[]> {
    if (ACCOUNT_ID.test(search)) {
      return [search.toLowerCase()];
    }
    return this.profilesService.searchAccountIds(search, MAX_SEARCH_MATCHES);
  }
}

function withAge(
  { dateOfBirth, ...account }: AccountOverview,
  today: string,
): Omit<AccountListItem, 'profile' | 'organization'> {
  return { ...account, age: dateOfBirth === null ? null : ageOn(today, dateOfBirth) };
}
