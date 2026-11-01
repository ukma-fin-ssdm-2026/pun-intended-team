// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../core/common/domain-error.ts';
import { ProfilesRepository } from '../../core/profiles/repositories/profiles.repository.ts';
import type {
  CommunicationFormat,
  NewProfile,
  Profile,
  ProfileChanges,
  ProfileSummary,
} from '../../core/profiles/types/profile.ts';
import type { DesiredCompany, Profile as ProfileRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

const withInterests = { profileInterests: { select: { interestId: true } } } as const;

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
  constructor(private readonly prisma: PrismaService) {}

  async findSummaries(accountIds: string[]): Promise<ProfileSummary[]> {
    return this.prisma.profile.findMany({
      where: { accountId: { in: accountIds } },
      select: { accountId: true, username: true, displayName: true },
    });
  }

  async findByAccountId(accountId: string): Promise<Profile | undefined> {
    const row = await this.prisma.profile.findUnique({ where: { accountId }, include: withInterests });
    return row ? toProfile(row) : undefined;
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
      .create({ data: { accountId, username, displayName }, include: withInterests })
      .catch(rethrowConflict);
    return toProfile(row);
  }

  async update(accountId: string, { communicationFormat, ...changes }: ProfileChanges): Promise<Profile> {
    const row = await this.prisma.profile
      .update({
        where: { accountId },
        data: {
          ...changes,
          ...(communicationFormat && { communicationFormat: toDesiredCompany[communicationFormat] }),
        },
        include: withInterests,
      })
      .catch(rethrowConflict);
    return toProfile(row);
  }

  async replaceInterests(accountId: string, interestIds: string[]): Promise<Profile> {
    const [, , row] = await this.prisma.$transaction([
      this.prisma.profileInterest.deleteMany({ where: { profileId: accountId } }),
      this.prisma.profileInterest.createMany({
        data: interestIds.map((interestId) => ({ profileId: accountId, interestId })),
      }),
      this.prisma.profile.findUniqueOrThrow({ where: { accountId }, include: withInterests }),
    ]);
    return toProfile(row);
  }
}

function toProfile(row: ProfileRow & { profileInterests: { interestId: string }[] }): Profile {
  return {
    accountId: row.accountId,
    username: row.username,
    displayName: row.displayName,
    description: row.description ?? '',
    communicationFormat: row.communicationFormat && toCommunicationFormat[row.communicationFormat],
    sharePhone: row.sharePhone,
    interestIds: row.profileInterests.map(({ interestId }) => interestId),
  };
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
