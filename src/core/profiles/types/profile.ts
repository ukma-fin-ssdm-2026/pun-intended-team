// Written with the help of Claude
export type CommunicationFormat = 'friends' | 'dating' | 'company';

export interface ProfileSummary {
  accountId: string;
  username: string;
  displayName: string;
}

/** Social networks a user can share with a mutual match, in the order they are shown. */
export const socialNetworks = ['telegram', 'instagram', 'whatsapp', 'tiktok', 'facebook'] as const;

export type SocialNetwork = (typeof socialNetworks)[number];

/** A social network and the user's handle in it, cleaned by socialNetworkHandle; revealed on a mutual match. */
export interface LinkedAccount {
  network: SocialNetwork;
  username: string;
}

/** What the owner sees: the handle and the profile link a mutual match opens. */
export interface LinkedAccountDetails extends LinkedAccount {
  url: string;
}

export interface Interest {
  id: string;
  name: string;
}

/** A profile as stored: interests by id, joined on read. */
export interface Profile extends ProfileSummary {
  description: string;
  occupation: string;
  /** Null until the user picks one during onboarding. */
  communicationFormat: CommunicationFormat | null;
  sharePhone: boolean;
  interestIds: string[];
  linkedAccounts: LinkedAccount[];
}

/** What the owner sees of their profile. */
export interface ProfileDetails {
  username: string;
  displayName: string;
  description: string;
  occupation: string;
  communicationFormat: CommunicationFormat | null;
  sharePhone: boolean;
  /** Whole years, computed from the account's date of birth; the date itself is never returned. */
  age: number;
  interests: Interest[];
  linkedAccounts: LinkedAccountDetails[];
  /** True once matching has what it needs: a communication format, an interest and a network to reveal. */
  isComplete: boolean;
}

/** The first onboarding step. */
export interface NewProfile {
  username: string;
  displayName: string;
}

export interface ProfileChanges {
  username?: string;
  displayName?: string;
  description?: string;
  occupation?: string;
  communicationFormat?: CommunicationFormat;
  sharePhone?: boolean;
}
