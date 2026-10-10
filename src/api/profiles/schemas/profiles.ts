// Written with the help of Claude
import { z } from 'zod';
import { Id } from '../../common/schemas/common.ts';

export const CommunicationFormat = z
  .enum(['friends', 'dating', 'company'])
  .meta({ id: 'CommunicationFormat', description: 'What the user is looking for when they go to an event' });

const InterestFields = z.object({
  id: Id,
  name: z.string(),
});

export const interestExample: Interest = {
  id: 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e01',
  name: 'Cinema',
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
  communicationFormat: CommunicationFormat.nullable().describe('Null until the user picks one'),
  sharePhone: z.boolean().describe('Whether the phone number is revealed on a mutual match'),
  age: z
    .number()
    .int()
    .describe('Whole years, computed from the account’s date of birth; the date itself is never returned'),
  interests: z.array(Interest),
  isComplete: z
    .boolean()
    .describe('True once communicationFormat and at least one interest are set; matching needs both'),
});

export const profileExample: Profile = {
  username: 'olena_k',
  displayName: 'Olena',
  description: 'Cinema, galleries and long walks.',
  communicationFormat: 'friends',
  sharePhone: true,
  age: 28,
  interests: [interestExample],
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

export type Interest = z.infer<typeof InterestFields>;
export type InterestList = z.infer<typeof InterestList>;
export type Profile = z.infer<typeof ProfileFields>;
export type CreateProfileBody = z.input<typeof CreateProfileFields>;
export type UpdateProfileBody = z.input<typeof UpdateProfileFields>;
export type ReplaceInterestsBody = z.input<typeof ReplaceInterestsFields>;
