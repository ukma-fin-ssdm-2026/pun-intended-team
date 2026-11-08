// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { Organization, OrganizationRequest, VerificationDecision } from '../types/organization.ts';

export abstract class OrganizationsRepository {
  abstract findByAccountId(accountId: string): Promise<Organization | undefined>;

  /** Saves the account's first request as pending; undefined when the account has an organization already. */
  abstract create(accountId: string, request: OrganizationRequest): Promise<Organization | undefined>;

  /**
   * Replaces a pending or rejected request and makes it pending again; undefined when the organization is in
   * another status.
   */
  abstract resubmit(accountId: string, request: OrganizationRequest): Promise<Organization | undefined>;

  /** Every organization, pending ones first, then verified, rejected and revoked; oldest first within each. */
  abstract findPage(page: PageRequest): Promise<Page<Organization>>;

  /** Records the decision on a pending request; false when it is not pending. */
  abstract decide(accountId: string, decision: VerificationDecision, adminId: string, at: Date): Promise<boolean>;
}
