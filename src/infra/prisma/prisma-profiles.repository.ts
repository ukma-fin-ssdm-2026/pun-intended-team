// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../core/common/domain-error.ts';
import { ProfilesRepository } from '../../core/profiles/repositories/profiles.repository.ts';
import {
  socialNetworks,
  type CommunicationFormat,
  type LinkedAccount,
  type SocialNetwork,
  type NewProfile,
  type Profile,
  type ProfileChanges,
  type ProfileSummary,
} from '../../core/profiles/types/profile.ts';
import type { DesiredCompany, Profile as ProfileRow } from './generated/client.ts';
import { PersonalDataCipher } from './personal-data-cipher.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

const withRelations = {
  profileInterests: { select: { interestId: true } },
  linkedAccounts: { select: { app: true, username: true } },
} as const;

type ProfileWithRelations = ProfileRow & {
  profileInterests: { interestId: string }[];
  linkedAccounts: { app: string; username: Uint8Array }[];
};

// The database calls the API's `company` `casual`; the type is shared with applications.desired_company.
const toDesiredCompany: Record<CommunicationFormat, DesiredCompany> = {
  friends: 'friends',
  dating: 'dating',
  company: 'casual',
};
const toCommunicationFormat: Record<DesiredCompany, CommunicationFormat> = {
  friends: 'friends',
  dating: 'dating',
  casual: 'company',
};

@Injectable()
export class PrismaProfilesRepository implements ProfilesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PersonalDataCipher,
  ) {}

  async findSummaries(accountIds: string[]): Promise<ProfileSummary[]> {
    return this.prisma.profile.findMany({
      where: { accountId: { in: accountIds } },
      select: { accountId: true, username: true, displayName: true },
    });
  }

  async findByAccountId(accountId: string): Promise<Profile | undefined> {
    const row = await this.prisma.profile.findUnique({ where: { accountId }, include: withRelations });
    return row ? this.toProfile(row) : undefined;
  }

  async isUsernameTaken(username: string, exceptAccountId?: string): Promise<boolean> {
    const taken = await this.prisma.profile.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, NOT: { accountId: exceptAccountId } },
      select: { accountId: true },
    });
    return taken !== null;
  }

  async create(accountId: string, { username, displayName }: NewProfile): Promise<Profile> {
    const row = await this.prisma.profile
      .create({ data: { accountId, username, displayName }, include: withRelations })
      .catch(rethrowConflict);
    return this.toProfile(row);
  }

  async update(accountId: string, { communicationFormat, ...changes }: ProfileChanges): Promise<Profile> {
    const row = await this.prisma.profile
      .update({
        where: { accountId },
        data: {
          ...changes,
          ...(communicationFormat && { communicationFormat: toDesiredCompany[communicationFormat] }),
        },
        include: withRelations,
      })
      .catch(rethrowConflict);
    return this.toProfile(row);
  }

  async replaceInterests(accountId: string, interestIds: string[]): Promise<Profile> {
    const [, , row] = await this.prisma.$transaction([
      this.prisma.profileInterest.deleteMany({ where: { profileId: accountId } }),
      this.prisma.profileInterest.createMany({
        data: interestIds.map((interestId) => ({ profileId: accountId, interestId })),
      }),
      this.prisma.profile.findUniqueOrThrow({ where: { accountId }, include: withRelations }),
    ]);
    return this.toProfile(row);
  }

  async replaceLinkedAccounts(accountId: string, linkedAccounts: LinkedAccount[]): Promise<Profile> {
    const [, , row] = await this.prisma.$transaction([
      this.prisma.linkedAccount.deleteMany({ where: { profileId: accountId } }),
      this.prisma.linkedAccount.createMany({
        data: linkedAccounts.map(({ network, username }) => ({
          profileId: accountId,
          app: network,
          username: this.cipher.encrypt(username),
        })),
      }),
      this.prisma.profile.findUniqueOrThrow({ where: { accountId }, include: withRelations }),
    ]);
    return this.toProfile(row);
  }

  private toProfile(row: ProfileWithRelations): Profile {
    return {
      accountId: row.accountId,
      username: row.username,
      displayName: row.displayName,
      description: row.description ?? '',
      occupation: row.occupation ?? '',
      communicationFormat: row.communicationFormat && toCommunicationFormat[row.communicationFormat],
      sharePhone: row.sharePhone,
      interestIds: row.profileInterests.map(({ interestId }) => interestId),
      linkedAccounts: row.linkedAccounts
        .filter((linked): linked is { app: SocialNetwork; username: Uint8Array } => isSocialNetwork(linked.app))
        .sort((a, b) => socialNetworks.indexOf(a.app) - socialNetworks.indexOf(b.app))
        .map(({ app, username }) => ({ network: app, username: this.cipher.decrypt(username) })),
    };
  }
}

// The column is plain text; the list of social networks lives in code.
function isSocialNetwork(app: string): app is SocialNetwork {
  return (socialNetworks as readonly string[]).includes(app);
}

// The service checks first; two requests at once can both pass, and the indexes stop the second.
function rethrowConflict(error: unknown): never {
  const index = violatedIndex(error);
  if (index === 'profiles_username_lower_key') {
    throw new DomainError('USERNAME_TAKEN', 'This username is already taken');
  }
  if (index === 'profiles_pkey') {
    throw new DomainError('PROFILE_EXISTS', 'The account already has a profile');
  }
  throw error;
}
