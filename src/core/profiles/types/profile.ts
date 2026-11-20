// Written with the help of Claude
export type CommunicationFormat = 'friends' | 'dating' | 'company';

/** The user's gender; "other" comes with the user's own words for it. */
export const genders = ['female', 'male', 'other'] as const;

export type Gender = (typeof genders)[number];

/** Whom a user wants to go with: anyone, or only women or only men. */
export const genderPreferences = ['any', 'female', 'male'] as const;

export type GenderPreference = (typeof genderPreferences)[number];

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
  /** The heading it is shown under, e.g. "Музика". */
  group: string;
}

/** A profile as stored: interests by id, joined on read. */
export interface Profile extends ProfileSummary {
  description: string;
  occupation: string;
  /** Null until the user picks one during onboarding. */
  communicationFormat: CommunicationFormat | null;
  /** Null until the user picks one; profiles made before genders were asked have none. */
  gender: Gender | null;
  /** The user's own words for an "other" gender; null for any other. */
  genderDescription: string | null;
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
  gender: Gender | null;
  genderDescription: string | null;
  sharePhone: boolean;
  /** Whole years, computed from the account's date of birth; the date itself is never returned. */
  age: number;
  interests: Interest[];
  linkedAccounts: LinkedAccountDetails[];
  /** True once matching has what it needs: a communication format, a gender, an interest and a network to reveal. */
  isComplete: boolean;
}

/** What a proposed match sees of the other user: no contacts (FR-019). */
export interface PublicProfile extends ProfileSummary {
  description: string;
  occupation: string;
  age: number;
  interests: Interest[];
}

/** What a mutual match sees of the other user (FR-019): the phone only if they share it. */
export interface Contacts {
  phone: string | null;
  linkedAccounts: LinkedAccountDetails[];
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
  /** A new gender replaces the description: kept for "other", dropped for the others. */
  gender?: Gender;
  genderDescription?: string;
  sharePhone?: boolean;
}

/** What matching needs of a user in the pool, besides their answers to the event. */
export interface MatchingTraits {
  interests: Interest[];
  gender: Gender | null;
  /** Whole years on the day matching runs for. */
  age: number;
}
