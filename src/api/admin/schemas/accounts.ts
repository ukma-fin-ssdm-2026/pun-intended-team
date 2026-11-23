// Written with the help of Claude
import { z } from 'zod';
import { Organization, organizationExample, VerificationStatus } from '../../catalog/schemas/organizations.ts';
import { DateTime, Id, PageQuery, pageOf, SearchText } from '../../common/schemas/common.ts';
import { CoverImage, Image } from '../../images/schemas/images.ts';
import { Interest, interestExample } from '../../profiles/schemas/profiles.ts';

const AccountRole = z.enum(['user', 'admin']).meta({ id: 'AccountRole' });

const AccountStatus = z.enum(['pending', 'active', 'banned']).meta({
  id: 'AccountStatus',
  description: '`pending`: signed in with Google, has not given a date of birth yet. `banned`: cannot sign in',
});

const AccountFields = z.object({
  id: Id,
  role: AccountRole,
  status: AccountStatus,
  signInMethods: z.array(z.enum(['google', 'password'])).describe('How the account signs in'),
  age: z.number().int().nullable().describe('Whole years; null while the account is pending'),
  createdAt: DateTime.describe('When the account was registered'),
});

const AdminAccountFields = AccountFields.extend({
  profile: z.object({ username: z.string(), displayName: z.string() }).nullable().describe('Null without a profile'),
  organization: z
    .object({ name: z.string(), verificationStatus: VerificationStatus })
    .nullable()
    .describe('Null when the account has not requested organization status'),
});

const adminAccountExample: AdminAccount = {
  id: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14',
  role: 'user',
  status: 'active',
  signInMethods: ['google'],
  age: 25,
  createdAt: '2026-10-12T09:30:00.000Z',
  profile: { username: 'olena_k', displayName: 'Olena' },
  organization: null,
};

export const AdminAccount = AdminAccountFields.meta({
  id: 'AdminAccount',
  description: 'An account as administrators see it in a list: without its phone number and date of birth',
  example: adminAccountExample,
});

export const AdminAccountsPage = pageOf(AdminAccount, 'AdminAccountsPage', adminAccountExample);

const AdminAccountDetailsFields = AccountFields.extend({
  profile: z
    .object({
      username: z.string(),
      displayName: z.string(),
      description: z.string(),
      occupation: z.string(),
      interests: z.array(Interest),
      photo: Image.nullable(),
      cover: CoverImage.nullable(),
    })
    .nullable()
    .describe('The profile as other users see it; null without a profile'),
  organization: Organization.nullable().describe('Null when the account has not requested organization status'),
});

const adminAccountDetailsExample: AdminAccountDetails = {
  ...adminAccountExample,
  profile: {
    username: 'olena_k',
    displayName: 'Olena',
    description: 'Cinema, galleries and long walks.',
    occupation: 'Student at Kyiv-Mohyla Academy',
    interests: [interestExample],
    photo: null,
    cover: null,
  },
  organization: { ...organizationExample, verificationStatus: 'verified', verifiedAt: '2026-10-14T12:00:00.000Z' },
};

export const AdminAccountDetails = AdminAccountDetailsFields.meta({
  id: 'AdminAccountDetails',
  description: 'One account as administrators see it: its profile and its organization request',
  example: adminAccountDetailsExample,
});

export const ListAccountsQuery = PageQuery.extend({
  search: SearchText.optional().describe('An account id, or part of a username or display name, in any case'),
  role: AccountRole.optional().describe('Only accounts with this role; `admin` lists the administrators'),
  status: AccountStatus.optional().describe('Only accounts in this status'),
});

export const AccountIdParams = z.object({
  id: Id.describe('Account id'),
});

export type AdminAccount = z.infer<typeof AdminAccountFields>;
export type AdminAccountsPage = z.infer<typeof AdminAccountsPage>;
export type AdminAccountDetails = z.infer<typeof AdminAccountDetailsFields>;
