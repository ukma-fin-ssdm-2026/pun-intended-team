// Written with the help of Claude
import type { OrganizationWithLogo } from '../../catalog/types/organization.ts';
import type { CaseAccount } from './report.ts';

/** An organization request as administrators review it, with the account that sent it. */
export interface OrganizationRequestReview extends OrganizationWithLogo {
  account: CaseAccount;
}
