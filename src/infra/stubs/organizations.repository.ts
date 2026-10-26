// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { OrganizationsRepository } from '../../core/catalog/repositories/organizations.repository.ts';
import type { Organization } from '../../core/catalog/types/organization.ts';
import { organizations } from './data.ts';

@Injectable()
export class StubOrganizationsRepository implements OrganizationsRepository {
  async findByAccountId(accountId: string): Promise<Organization | undefined> {
    return organizations.find((organization) => organization.accountId === accountId);
  }
}
