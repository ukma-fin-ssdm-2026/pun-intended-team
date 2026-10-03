// Written with the help of Claude
import type { Organization } from '../types/organization.js';

export abstract class OrganizationsRepository {
  abstract findByAccountId(accountId: string): Promise<Organization | undefined>;
}
