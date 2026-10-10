// Written with the help of Claude
import type { Organization } from '../types/organization.ts';

export abstract class OrganizationsRepository {
  abstract findByAccountId(accountId: string): Promise<Organization | undefined>;
}
