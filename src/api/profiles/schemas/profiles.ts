// Written with the help of Claude
import { z } from 'zod';
import { socialNetworks } from '../../../core/profiles/types/profile.ts';
import { Id } from '../../common/schemas/common.ts';

export const CommunicationFormat = z
  .enum(['friends', 'dating', 'company'])
  .meta({ id: 'CommunicationFormat', description: 'What the user is looking for when they go to an event' });

export const SocialNetwork = z
  .enum(socialNetworks)
  .meta({ id: 'SocialNetwork', description: 'A social network whose handle a mutual match sees' });

const LinkedAccountFields = z.object({
  network: SocialNetwork,
  username: z.string().describe('The handle, without "@"; for WhatsApp, the phone number digits'),
  url: z.string().describe('The profile link a mutual match opens'),
});

export const linkedAccountExample: LinkedAccount = {
  network: 'telegram',
  username: 'olena_k',
  url: 'https://t.me/olena_k',
};

export const LinkedAccount = LinkedAccountFields.meta({
  id: 'LinkedAccount',
  description: 'A social network the user shares with a mutual match',
  example: linkedAccountExample,
});

const InterestFields = z.object({
  id: Id,
  name: z.string(),
  group: z.string().describe('The heading the interest is shown under'),
});

export const interestExample: Interest = {
  id: 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e01',
  name: 'Книги',
  group: 'Книги й комікси',
};

export const Interest = InterestFields.meta({
  id: 'Interest',
  description: 'An interest from the fixed list users pick from',
  example: interestExample,
});

export const InterestList = z
  .object({ items: z.array(Interest) })
  .meta({ id: 'InterestList', example: { items: [interestExample] } });

const ProfileFields = z.object({
  username: z.string(),
  displayName: z.string(),
  description: z.string(),
  occupation: z.string().describe('What the user does, e.g. their studies or work; can be empty'),
  communicationFormat: CommunicationFormat.nullable().describe('Null until the user picks one'),
  sharePhone: z.boolean().describe('Whether the phone number is revealed on a mutual match'),
  age: z
    .number()
    .int()
    .describe('Whole years, computed from the account’s date of birth; the date itself is never returned'),
  interests: z.array(Interest),
  linkedAccounts: z.array(LinkedAccount).describe('Revealed to a mutual match, in the order of SocialNetwork'),
  isComplete: z
    .boolean()
    .describe(
      'True once communicationFormat, at least one interest and at least one linked account are set; matching needs all three',
    ),
});

export const profileExample: Profile = {
  username: 'olena_k',
  displayName: 'Olena',
  description: 'Cinema, galleries and long walks.',
  occupation: 'Student at Kyiv-Mohyla Academy',
  communicationFormat: 'friends',
  sharePhone: true,
  age: 28,
  interests: [interestExample],
  linkedAccounts: [linkedAccountExample],
  isComplete: true,
};

export const Profile = ProfileFields.meta({
  id: 'Profile',
  description: 'The signed-in user’s own profile',
  example: profileExample,
});

// Letters and digits first, so a name cannot start with a dot or an underscore; no spaces.
const Username = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._]{2,29}$/,
    'Must be 3 to 30 characters: letters, digits, dots or underscores, starting with a letter or digit',
  )
  .describe('Unique, case-insensitive; 3 to 30 letters, digits, dots or underscores');

const DisplayName = z.string().trim().min(1).max(50).describe('The name other users see');

const Description = z.string().trim().max(500).describe('Free text about the user; can be empty');

const Occupation = z.string().trim().max(100).describe('What the user does, e.g. their studies or work; can be empty');

const CreateProfileFields = z.strictObject({
  username: Username,
  displayName: DisplayName,
});

export const createProfileExample: CreateProfileBody = { username: 'olena_k', displayName: 'Olena' };

export const CreateProfileBody = CreateProfileFields.meta({
  id: 'CreateProfileBody',
  description: 'The first onboarding step; everything else is added with PATCH',
  example: createProfileExample,
});

const UpdateProfileFields = z
  .strictObject({
    displayName: DisplayName.optional(),
    username: Username.optional(),
    description: Description.optional(),
    occupation: Occupation.optional(),
    communicationFormat: CommunicationFormat.optional(),
    sharePhone: z.boolean().optional().describe('Whether the phone number is revealed on a mutual match'),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Send at least one field to change',
  });

export const UpdateProfileBody = UpdateProfileFields.meta({
  id: 'UpdateProfileBody',
  description: 'Only the fields to change; at least one',
  example: { communicationFormat: 'friends' } satisfies UpdateProfileBody,
});

const ReplaceInterestsFields = z.strictObject({
  interestIds: z
    .array(Id)
    .max(30)
    .describe('Ids from listInterests; the whole set is replaced, so an empty list clears it'),
});

export const ReplaceInterestsBody = ReplaceInterestsFields.meta({
  id: 'ReplaceInterestsBody',
  example: { interestIds: [interestExample.id] } satisfies ReplaceInterestsBody,
});

const NewLinkedAccount = z.strictObject({
  network: SocialNetwork,
  username: z
    .string()
    .max(200)
    .describe(
      'A nickname with or without "@", or a profile link; for WhatsApp, a phone number. Kept as the bare handle; one that does not fit is INVALID_SOCIAL_HANDLE',
    ),
});

const ReplaceLinkedAccountsFields = z.strictObject({
  linkedAccounts: z
    .array(NewLinkedAccount)
    .max(socialNetworks.length)
    .refine((items) => new Set(items.map((item) => item.network)).size === items.length, {
      message: 'Each social network may appear once',
    })
    .describe(
      'The whole set, at most one per social network; an empty list is CONTACT_REQUIRED, since a mutual match needs a contact',
    ),
});

export const ReplaceLinkedAccountsBody = ReplaceLinkedAccountsFields.meta({
  id: 'ReplaceLinkedAccountsBody',
  example: { linkedAccounts: [{ network: 'telegram', username: '@olena_k' }] } satisfies ReplaceLinkedAccountsBody,
});

export type LinkedAccount = z.infer<typeof LinkedAccountFields>;
export type Interest = z.infer<typeof InterestFields>;
export type InterestList = z.infer<typeof InterestList>;
export type Profile = z.infer<typeof ProfileFields>;
export type CreateProfileBody = z.input<typeof CreateProfileFields>;
export type UpdateProfileBody = z.input<typeof UpdateProfileFields>;
export type ReplaceInterestsBody = z.input<typeof ReplaceInterestsFields>;
export type ReplaceLinkedAccountsBody = z.input<typeof ReplaceLinkedAccountsFields>;
