// Written with the help of Claude
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

/** A regular account that also acts as an organization; it publishes events only when verified (FR-003). */
export interface Organization {
  accountId: string;
  name: string;
  description: string | null;
  officialLink: string | null;
  verificationStatus: VerificationStatus;
  /** When an administrator verified it; null otherwise. */
  verifiedAt: string | null;
}

/** What an account sends to become a verified organization. */
export interface OrganizationRequest {
  name: string;
  description: string;
  officialLink: string;
}

/** An administrator's decision on a pending request. */
export type VerificationDecision = 'verified' | 'rejected';
