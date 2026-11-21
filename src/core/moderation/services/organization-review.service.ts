// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { OrganizationsService } from '../../catalog/services/organizations.service.ts';
import type {
  OrganizationSearch,
  OrganizationWithLogo,
  VerificationDecision,
} from '../../catalog/types/organization.ts';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { AuditLogRepository } from '../repositories/audit-log.repository.ts';
import type { OrganizationRequestReview } from '../types/organization-review.ts';

const actions: Record<VerificationDecision, string> = {
  verified: 'organization.approve',
  rejected: 'organization.reject',
};

/** Administrators verify or reject organization requests (FR-003); every decision is audited (SEC-004). */
@Injectable()
export class OrganizationReviewService {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly profilesService: ProfilesService,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async list(filter: OrganizationSearch, page: PageRequest): Promise<Page<OrganizationRequestReview>> {
    const { items, page: info } = await this.organizationsService.listRequests(filter, page);
    return { items: await this.withAccounts(items), page: info };
  }

  async get(accountId: string): Promise<OrganizationRequestReview> {
    const organization = await this.organizationsService.find(accountId);
    if (!organization) {
      throw new DomainError('NOT_FOUND', 'No organization request for this account');
    }
    const [review] = await this.withAccounts([organization]);
    return review!;
  }

  /** Decides a pending request; an administrator cannot decide their own. */
  async decide(accountId: string, decision: VerificationDecision, adminId: string): Promise<OrganizationWithLogo> {
    const action = actions[decision];
    if (!(await this.organizationsService.find(accountId))) {
      throw new DomainError('NOT_FOUND', 'No organization request for this account');
    }
    if (accountId === adminId) {
      await this.audit(adminId, action, accountId, 'refused: own request');
      throw new DomainError('CANNOT_DECIDE_OWN_REQUEST', 'Your own request is decided by another administrator');
    }
    if (!(await this.organizationsService.decide(accountId, decision, adminId))) {
      await this.audit(adminId, action, accountId, 'refused: not pending');
      throw new DomainError('CONFLICT', 'The request is not pending');
    }
    await this.audit(adminId, action, accountId, decision);
    return this.organizationsService.getOwn(accountId);
  }

  private async withAccounts(organizations: OrganizationWithLogo[]): Promise<OrganizationRequestReview[]> {
    const summaries = await this.profilesService.getSummaries(organizations.map((item) => item.accountId));
    return organizations.map((organization) => {
      const summary = summaries.get(organization.accountId);
      return {
        ...organization,
        account: {
          id: organization.accountId,
          username: summary?.username ?? null,
          displayName: summary?.displayName ?? null,
        },
      };
    });
  }

  private async audit(actorId: string, action: string, accountId: string, result: string): Promise<void> {
    await this.auditLogRepository.record({ actorId, action, targetType: 'organization', targetId: accountId, result });
  }
}
