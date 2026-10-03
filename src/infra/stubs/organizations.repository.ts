// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { OrganizationsRepository } from '../../core/catalog/repositories/organizations.repository.js';
import type { Organization } from '../../core/catalog/types/organization.js';
import { organizations } from './data.js';

@Injectable()
export class StubOrganizationsRepository implements OrganizationsRepository {
  async findByAccountId(accountId: string): Promise<Organization | undefined> {
    return organizations.find((organization) => organization.accountId === accountId);
  }
}
