// Written with the help of Claude
import { DomainError } from '../../common/domain-error.ts';
import type { OrganizationsRepository } from '../repositories/organizations.repository.ts';

/** Only a verified organization publishes events and adds venues. */
export async function requireVerifiedOrganization(
  organizationsRepository: OrganizationsRepository,
  accountId: string,
): Promise<void> {
  const organization = await organizationsRepository.findByAccountId(accountId);
  if (organization?.verificationStatus !== 'verified') {
    throw new DomainError('ORGANIZATION_NOT_VERIFIED', 'Only a verified organization can publish events');
  }
}
