// Written with the help of Claude
import { z } from 'zod';
import { Id } from '../../common/schemas/common.ts';
import { CoverImage, Image } from '../../images/schemas/images.ts';
import {
  CommunicationFormat,
  Interest,
  interestExample,
  LinkedAccount,
  linkedAccountExample,
} from '../../profiles/schemas/profiles.ts';
import { AfterEventPlan, ApplicationSession } from './applications.ts';

export const MatchStatus = z.enum(['proposed', 'accepted', 'mutual', 'declined', 'expired', 'cancelled']).meta({
  id: 'MatchStatus',
  description:
    'As the caller sees it. `proposed`: waiting for the caller’s answer; whether the other has accepted stays ' +
    'hidden. `accepted`: the caller accepted and waits for the other. `mutual`: both accepted, the contacts are ' +
    'open. `declined`: one of the two declined. `expired`: not answered in time. `cancelled`: one of the two ' +
    'withdrew, the event was cancelled or a user was banned',
});

const MatchPartnerFields = z.object({
  username: z.string(),
  displayName: z.string(),
  description: z.string(),
  occupation: z.string(),
  age: z.number().int().describe('Whole years'),
  interests: z.array(Interest),
  photo: Image.nullable().describe('The avatar; null shows the initial'),
  cover: CoverImage.nullable().describe('null shows the default gradient'),
  desiredCompany: CommunicationFormat.describe('What kind of company they are looking for at this event'),
  afterEventPlans: z
    .array(AfterEventPlan)
    .describe('What they would do together after the event; empty: only the event'),
});

const MatchFields = z.object({
  id: Id,
  eventId: Id,
  applicationId: Id.describe('The caller’s own application'),
  status: MatchStatus,
  days: z
    .array(ApplicationSession)
    .describe('The days both can go, soonest first: one for a single-day event; the two pick one of them'),
  validUntil: z.iso
    .datetime({ offset: true })
    .describe('Until then the proposal waits for both answers: 24 hours, or until the next round or the cutoff'),
  partner: MatchPartnerFields.describe('The other user’s public profile and answers, without contacts (FR-019)'),
  createdAt: z.iso.datetime({ offset: true }),
});

export const matchExample: Match = {
  id: '6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  eventId: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
  applicationId: '4c8e2a6d-0b3f-4d5e-9a7c-1e3f5b7d9a11',
  status: 'proposed',
  days: [{ startsAt: '2026-10-24T16:00:00.000Z', cutoffAt: '2026-10-24T15:00:00.000Z' }],
  validUntil: '2026-10-22T09:00:00.000Z',
  partner: {
    username: 'olena_k',
    displayName: 'Olena',
    description: 'Cinema, galleries and long walks.',
    occupation: 'Illustrator',
    age: 24,
    interests: [interestExample],
    photo: null,
    cover: null,
    desiredCompany: 'company',
    afterEventPlans: ['walk', 'coffee'],
  },
  createdAt: '2026-10-21T09:00:00.000Z',
};

export const Match = MatchFields.meta({
  id: 'Match',
  description: 'A proposed match as one of the two users sees it',
  example: matchExample,
});

export const MatchList = z.array(Match).meta({ id: 'MatchList', example: [matchExample] });

export const MatchIdParams = z.object({
  id: Id.describe('Match id'),
});

const MatchContactsFields = z.object({
  phone: z.string().nullable().describe('Only if they share it; null while sign-in is Google-only'),
  linkedAccounts: z.array(LinkedAccount),
});

export const MatchContacts = MatchContactsFields.meta({
  id: 'MatchContacts',
  description: 'How to reach the other user of a mutual match (FR-019)',
  example: { phone: null, linkedAccounts: [linkedAccountExample] },
});

export type Match = z.infer<typeof MatchFields>;
export type MatchContacts = z.infer<typeof MatchContactsFields>;
