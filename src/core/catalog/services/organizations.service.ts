// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { socialNetworkHandle, socialNetworkHint } from '../../common/social-networks.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { ImagesService } from '../../images/services/images.service.ts';
import type { ImageUpload } from '../../images/types/image.ts';
import { OrganizationsRepository } from '../repositories/organizations.repository.ts';
import type {
  Organization,
  OrganizationRequest,
  OrganizationSearch,
  OrganizationWithLogo,
  PublicOrganization,
  VerificationDecision,
} from '../types/organization.ts';

/** Organization status (FR-003): an account requests it, and an administrator verifies or rejects the request. */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly imagesService: ImagesService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** The caller's organization with its verification status; NOT_FOUND before the first request. */
  async getOwn(accountId: string): Promise<OrganizationWithLogo> {
    return this.withLogo(await this.getStored(accountId));
  }

  /** A verified organization's page; NOT_FOUND for any other account, so a pending request stays private. */
  async getPublic(accountId: string): Promise<PublicOrganization> {
    const organization = await this.organizationsRepository.findByAccountId(accountId);
    if (organization?.verificationStatus !== 'verified') {
      throw new DomainError('NOT_FOUND', 'Organization not found');
    }
    const { name, description, officialLink, instagram, logo } = await this.withLogo(organization);
    return { id: accountId, name, description, officialLink, instagram, logo };
  }

  /** Sets or replaces the logo, in any verification status. */
  async setLogo(accountId: string, upload: ImageUpload): Promise<OrganizationWithLogo> {
    const organization = await this.getStored(accountId);
    const prepared = await this.imagesService.prepare('organizationLogo', upload);
    const updated = await this.transactions.run(async (tx) => {
      const image = await this.imagesService.save(accountId, prepared, tx);
      const changed = await this.organizationsRepository.setLogo(accountId, image.id, tx);
      await this.imagesService.remove([organization.logoId], tx);
      return changed;
    });
    return this.withLogo(updated);
  }

  /** Without a logo, nothing changes. */
  async removeLogo(accountId: string): Promise<OrganizationWithLogo> {
    const organization = await this.getStored(accountId);
    const { logoId } = organization;
    if (logoId === null) {
      return { ...organization, logo: null };
    }
    const updated = await this.transactions.run(async (tx) => {
      const changed = await this.organizationsRepository.setLogo(accountId, null, tx);
      await this.imagesService.remove([logoId], tx);
      return changed;
    });
    return { ...updated, logo: null };
  }

  /**
   * Sends the request, which waits as pending for an administrator. A pending request is replaced, and a rejected one
   * can be sent again; a verified or revoked organization cannot change its request, its Instagram included. The
   * Instagram username is kept bare, as profiles keep it.
   */
  async request(accountId: string, input: OrganizationRequest): Promise<OrganizationWithLogo> {
    const request = { ...input, instagram: instagramOf(input.instagram) };
    const existing = await this.organizationsRepository.findByAccountId(accountId);
    // A parallel first request can create the row in between; this one then replaces it.
    const saved = existing
      ? await this.organizationsRepository.resubmit(accountId, request)
      : ((await this.organizationsRepository.create(accountId, request)) ??
        (await this.organizationsRepository.resubmit(accountId, request)));
    if (!saved) {
      throw new DomainError('CONFLICT', 'The organization is already verified, or its verification was revoked');
    }
    return this.withLogo(saved);
  }

  async find(accountId: string): Promise<OrganizationWithLogo | undefined> {
    const organization = await this.organizationsRepository.findByAccountId(accountId);
    return organization && this.withLogo(organization);
  }

  async listRequests(filter: OrganizationSearch, page: PageRequest): Promise<Page<OrganizationWithLogo>> {
    const found = await this.organizationsRepository.findPage(filter, page);
    return { ...found, items: await this.withLogos(found.items) };
  }

  /** By account id; accounts that are not organizations are left out. */
  async findMany(accountIds: string[]): Promise<Map<string, Organization>> {
    const organizations = await this.organizationsRepository.findByAccountIds([...new Set(accountIds)]);
    return new Map(organizations.map((organization) => [organization.accountId, organization]));
  }

  /** Records an administrator's decision on a pending request; false when it is not pending. */
  async decide(accountId: string, decision: VerificationDecision, adminId: string): Promise<boolean> {
    return this.organizationsRepository.decide(accountId, decision, adminId, new Date());
  }

  private async getStored(accountId: string): Promise<Organization> {
    const organization = await this.organizationsRepository.findByAccountId(accountId);
    if (!organization) {
      throw new DomainError('NOT_FOUND', 'You have not requested organization status');
    }
    return organization;
  }

  private async withLogo(organization: Organization): Promise<OrganizationWithLogo> {
    const [withLogo] = await this.withLogos([organization]);
    return withLogo!;
  }

  private async withLogos(organizations: Organization[]): Promise<OrganizationWithLogo[]> {
    const logos = await this.imagesService.getRefs(organizations.map((organization) => organization.logoId));
    return organizations.map((organization) => ({
      ...organization,
      logo: (organization.logoId !== null && logos.get(organization.logoId)) || null,
    }));
  }
}

function instagramOf(input: string | null | undefined): string | null {
  if (input === undefined || input === null || input.trim() === '') {
    return null;
  }
  const handle = socialNetworkHandle('instagram', input);
  if (handle === undefined) {
    throw new DomainError('INVALID_SOCIAL_HANDLE', `Expected ${socialNetworkHint('instagram')}`, 'instagram');
  }
  return handle;
}
