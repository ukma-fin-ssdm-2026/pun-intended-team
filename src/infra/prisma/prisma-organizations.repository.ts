// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { OrganizationsRepository } from '../../core/catalog/repositories/organizations.repository.ts';
import type {
  Organization,
  OrganizationRequest,
  OrganizationSearch,
  VerificationDecision,
} from '../../core/catalog/types/organization.ts';
import type { Organization as OrganizationRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';
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

  async findPage({ search, status }: OrganizationSearch, { limit, offset }: PageRequest): Promise<Page<Organization>> {
    // The enum sorts in its declared order: pending, verified, rejected, revoked.
    const rows = await this.prisma.organization.findMany({
      where: { verificationStatus: status, name: search ? { contains: search, mode: 'insensitive' } : undefined },
      orderBy: [{ verificationStatus: 'asc' }, { updatedAt: 'asc' }, { accountId: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toOrganization),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async findByAccountIds(accountIds: string[]): Promise<Organization[]> {
    const rows = await this.prisma.organization.findMany({ where: { accountId: { in: accountIds } } });
    return rows.map(toOrganization);
  }

  async setLogo(accountId: string, logoId: string | null, tx?: Transaction): Promise<Organization> {
    return toOrganization(
      await clientOf(this.prisma, tx).organization.update({ where: { accountId }, data: { logoId } }),
    );
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
    logoId: row.logoId,
  };
}
