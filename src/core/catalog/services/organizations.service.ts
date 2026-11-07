// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { OrganizationsRepository } from '../repositories/organizations.repository.ts';
import type { Organization, OrganizationRequest, VerificationDecision } from '../types/organization.ts';

/** Organization status (FR-003): an account requests it, and an administrator verifies or rejects the request. */
@Injectable()
export class OrganizationsService {
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}

  /** The caller's organization with its verification status; NOT_FOUND before the first request. */
  async getOwn(accountId: string): Promise<Organization> {
    const organization = await this.organizationsRepository.findByAccountId(accountId);
    if (!organization) {
      throw new DomainError('NOT_FOUND', 'You have not requested organization status');
    }
    return organization;
  }

  /**
   * Sends the request, which waits as pending for an administrator. A pending request is replaced, and a rejected one
   * can be sent again; a verified or revoked organization cannot change its request.
   */
  async request(accountId: string, request: OrganizationRequest): Promise<Organization> {
    const existing = await this.organizationsRepository.findByAccountId(accountId);
    // A parallel first request can create the row in between; this one then replaces it.
    const saved = existing
      ? await this.organizationsRepository.resubmit(accountId, request)
      : ((await this.organizationsRepository.create(accountId, request)) ??
        (await this.organizationsRepository.resubmit(accountId, request)));
    if (!saved) {
      throw new DomainError('CONFLICT', 'The organization is already verified, or its verification was revoked');
    }
    return saved;
  }

  async find(accountId: string): Promise<Organization | undefined> {
    return this.organizationsRepository.findByAccountId(accountId);
  }

  async listRequests(page: PageRequest): Promise<Page<Organization>> {
    return this.organizationsRepository.findPage(page);
  }

  /** Records an administrator's decision on a pending request; false when it is not pending. */
  async decide(accountId: string, decision: VerificationDecision, adminId: string): Promise<boolean> {
    return this.organizationsRepository.decide(accountId, decision, adminId, new Date());
  }
}
