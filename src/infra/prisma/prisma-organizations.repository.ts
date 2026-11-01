// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { OrganizationsRepository } from '../../core/catalog/repositories/organizations.repository.ts';
import type { Organization } from '../../core/catalog/types/organization.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaOrganizationsRepository implements OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccountId(accountId: string): Promise<Organization | undefined> {
    const organization = await this.prisma.organization.findUnique({
      where: { accountId },
      select: { accountId: true, name: true, verificationStatus: true },
    });
    return organization ?? undefined;
  }
}
