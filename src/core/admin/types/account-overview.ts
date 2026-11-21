// Written with the help of Claude
import type { Organization, OrganizationWithLogo } from '../../catalog/types/organization.ts';
import type { AccountOverview, AccountStatus } from '../../identity/types/account.ts';
import type { AccountRole } from '../../identity/types/caller.ts';
import type { ProfileSummary, PublicProfile } from '../../profiles/types/profile.ts';

/** Which accounts the admin panel lists; `search` is an account id, or part of a username or display name. */
export interface AccountQuery {
  search?: string;
  role?: AccountRole;
  status?: AccountStatus;
}

/** An account in the admin panel's list: no contact, and the age instead of the date of birth. */
export interface AccountListItem extends Omit<AccountOverview, 'dateOfBirth'> {
  /** Whole years; null while the account is pending. */
  age: number | null;
  profile: Pick<ProfileSummary, 'username' | 'displayName'> | null;
  organization: Pick<Organization, 'name' | 'verificationStatus'> | null;
}

/** One account in the admin panel: its profile as other users see it, and its organization request. */
export interface AccountDetails extends Omit<AccountListItem, 'profile' | 'organization'> {
  profile: PublicProfile | null;
  organization: OrganizationWithLogo | null;
}
