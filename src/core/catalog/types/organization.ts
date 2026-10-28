// Written with the help of Claude
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

/** A regular account that also acts as an organization; it publishes events only when verified. */
export interface Organization {
  accountId: string;
  name: string;
  verificationStatus: VerificationStatus;
}
