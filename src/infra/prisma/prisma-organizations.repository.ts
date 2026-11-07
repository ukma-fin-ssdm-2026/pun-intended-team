// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { OrganizationsRepository } from '../../core/catalog/repositories/organizations.repository.ts';
import type { Organization, OrganizationRequest, VerificationDecision } from '../../core/catalog/types/organization.ts';
import type { Organization as OrganizationRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

const ORGANIZATION_KEY = 'organizations_pkey';

@Injectable()
export class PrismaOrganizationsRepository implements OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccountId(accountId: string): Promise<Organization | undefined> {
    const row = await this.prisma.organization.findUnique({ where: { accountId } });
    return row ? toOrganization(row) : undefined;
  }

  async create(accountId: string, request: OrganizationRequest): Promise<Organization | undefined> {
    try {
      return toOrganization(await this.prisma.organization.create({ data: { accountId, ...request } }));
    } catch (error) {
      if (violatedIndex(error) === ORGANIZATION_KEY) {
        return undefined;
      }
      throw error;
    }
  }

  async resubmit(accountId: string, request: OrganizationRequest): Promise<Organization | undefined> {
    const { count } = await this.prisma.organization.updateMany({
      where: { accountId, verificationStatus: { in: ['pending', 'rejected'] } },
      data: { ...request, verificationStatus: 'pending', verifiedById: null, verifiedAt: null },
    });
    return count === 1 ? this.findByAccountId(accountId) : undefined;
  }

  async findPage({ limit, offset }: PageRequest): Promise<Page<Organization>> {
    // The enum sorts in its declared order: pending, verified, rejected, revoked.
    const rows = await this.prisma.organization.findMany({
      orderBy: [{ verificationStatus: 'asc' }, { updatedAt: 'asc' }, { accountId: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toOrganization),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async decide(accountId: string, decision: VerificationDecision, adminId: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.organization.updateMany({
      where: { accountId, verificationStatus: 'pending' },
      data:
        decision === 'verified'
          ? { verificationStatus: 'verified', verifiedById: adminId, verifiedAt: at }
          : { verificationStatus: 'rejected' },
    });
    return count === 1;
  }
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    accountId: row.accountId,
    name: row.name,
    description: row.description,
    officialLink: row.officialLink,
    verificationStatus: row.verificationStatus,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  };
}
