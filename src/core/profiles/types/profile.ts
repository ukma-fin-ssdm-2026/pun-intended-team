// Written with the help of Claude
export type CommunicationFormat = 'friends' | 'dating' | 'company';

export interface ProfileSummary {
  accountId: string;
  username: string;
  displayName: string;
}

export interface Interest {
  id: string;
  name: string;
}

/** A profile as stored: interests by id, joined on read. */
export interface Profile extends ProfileSummary {
  description: string;
  /** Null until the user picks one during onboarding. */
  communicationFormat: CommunicationFormat | null;
  sharePhone: boolean;
  interestIds: string[];
}

/** What the owner sees of their profile. */
export interface ProfileDetails {
  username: string;
  displayName: string;
  description: string;
  communicationFormat: CommunicationFormat | null;
  sharePhone: boolean;
  /** Whole years, computed from the account's date of birth; the date itself is never returned. */
  age: number;
  interests: Interest[];
  /** True once matching has what it needs: a communication format and at least one interest. */
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
  communicationFormat?: CommunicationFormat;
  sharePhone?: boolean;
}
