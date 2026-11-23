// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { Transaction } from '../../common/transaction.ts';
import type {
  Organization,
  OrganizationRequest,
  OrganizationSearch,
  VerificationDecision,
} from '../types/organization.ts';

export abstract class OrganizationsRepository {
  abstract findByAccountId(accountId: string): Promise<Organization | undefined>;

  /** Saves the account's first request as pending; undefined when the account has an organization already. */
  abstract create(accountId: string, request: OrganizationRequest): Promise<Organization | undefined>;

  /**
   * Replaces a pending or rejected request and makes it pending again; undefined when the organization is in
   * another status.
   */
  abstract resubmit(accountId: string, request: OrganizationRequest): Promise<Organization | undefined>;

  /** Organizations that match, pending ones first, then verified, rejected and revoked; oldest first within each. */
  abstract findPage(filter: OrganizationSearch, page: PageRequest): Promise<Page<Organization>>;

  /** The organizations of these accounts; accounts that are not organizations are left out. */
  abstract findByAccountIds(accountIds: string[]): Promise<Organization[]>;

  abstract setLogo(accountId: string, logoId: string | null, tx?: Transaction): Promise<Organization>;

  /** Records the decision on a pending request; false when it is not pending. */
  abstract decide(accountId: string, decision: VerificationDecision, adminId: string, at: Date): Promise<boolean>;
}
