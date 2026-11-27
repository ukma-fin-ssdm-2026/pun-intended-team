// Written with the help of Claude
import type { ImageRef } from '../../images/types/image.ts';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

/** A regular account that also acts as an organization; it publishes events only when verified (FR-003). */
export interface Organization {
  accountId: string;
  name: string;
  description: string | null;
  officialLink: string | null;
  /** The Instagram username, without "@". */
  instagram: string | null;
  verificationStatus: VerificationStatus;
  /** When an administrator verified it; null otherwise. */
  verifiedAt: string | null;
  logoId: string | null;
}

/** The caller's organization as the API returns it: with its logo's size. */
export type OrganizationWithLogo = Organization & { logo: ImageRef | null };

/** A verified organization as anyone sees it: on its page, without its account or verification details. */
export interface PublicOrganization {
  /** The organization's account id. */
  id: string;
  name: string;
  description: string | null;
  officialLink: string | null;
  instagram: string | null;
  logo: ImageRef | null;
}

/** The organization that added an event or a venue. */
export type OrganizationName = Pick<Organization, 'accountId' | 'name'>;

/** Which organizations the admin panel lists; `search` matches part of the name, in any case. */
export interface OrganizationSearch {
  search?: string;
  status?: VerificationStatus;
}

/** What an account sends to become a verified organization. */
export interface OrganizationRequest {
  name: string;
  description: string;
  officialLink: string;
}

/** An administrator's decision on a pending request. */
export type VerificationDecision = 'verified' | 'rejected';
