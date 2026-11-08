// Written with the help of Claude
import { z } from 'zod';
import { afterEventPlans } from '../../../core/matching/types/application.ts';
import { CalendarDate, Id } from '../../common/schemas/common.ts';
import { CommunicationFormat } from '../../profiles/schemas/profiles.ts';

export const AfterEventPlan = z
  .enum(afterEventPlans)
  .meta({ id: 'AfterEventPlan', description: 'Something to do together after the event' });

export const ApplicationStatus = z
  .enum(['in_pool', 'paired', 'paused', 'removed', 'withdrawn', 'no_match', 'cancelled'])
  .meta({
    id: 'ApplicationStatus',
    description:
      '`in_pool`: waiting for a match. `paired`: a match is proposed. `paused`: a proposal went unanswered, waiting ' +
      'for the user to continue. `removed`: a second proposal went unanswered. `withdrawn`: the user left the pool. ' +
      '`no_match`: no match was found before the event. `cancelled`: the event was cancelled or the user banned',
  });

const AfterEventPlans = z
  .array(AfterEventPlan)
  .max(afterEventPlans.length)
  .refine((plans) => new Set(plans).size === plans.length, { message: 'Each plan may appear once' })
  .describe('What the user would do together after the event; an empty list means only the event');

const ApplicationFields = z.object({
  id: Id,
  eventId: Id,
  sessionStartsAt: z.iso
    .datetime({ offset: true })
    .describe('When the session starts: the event start, or the chosen day of a multi-day event at its time of day'),
  desiredCompany: CommunicationFormat,
  afterEventPlans: z
    .array(AfterEventPlan)
    .describe('What the user would do together after the event; empty: only the event'),
  status: ApplicationStatus,
  nextRoundAt: z.iso
    .datetime({ offset: true })
    .nullable()
    .describe(
      'When the next matching round pairs the pool; null when the application is not waiting in the pool or no round is left',
    ),
  createdAt: z.iso.datetime({ offset: true }),
});

export const applicationExample: Application = {
  id: '4c8e2a6d-0b3f-4d5e-9a7c-1e3f5b7d9a11',
  eventId: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
  sessionStartsAt: '2026-10-24T16:00:00.000Z',
  desiredCompany: 'company',
  afterEventPlans: ['walk', 'coffee'],
  status: 'in_pool',
  nextRoundAt: '2026-10-21T16:00:00.000Z',
  createdAt: '2026-10-15T09:00:00.000Z',
};

export const Application = ApplicationFields.meta({
  id: 'Application',
  description: 'The caller’s request to be matched in one session of an event',
  example: applicationExample,
});

export const ApplicationList = z.array(Application).meta({ id: 'ApplicationList', example: [applicationExample] });

export const ApplicationIdParams = z.object({
  id: Id.describe('Application id'),
});

const CreateApplicationFields = z.strictObject({
  date: CalendarDate.optional().describe('The Kyiv day to go on; needed only for an event that runs on several days'),
  desiredCompany: CommunicationFormat.describe('What kind of company the user is looking for at this event'),
  afterEventPlans: AfterEventPlans,
});

export const createApplicationExample: CreateApplicationBody = {
  desiredCompany: 'company',
  afterEventPlans: ['walk', 'coffee'],
};

export const CreateApplicationBody = CreateApplicationFields.meta({
  id: 'CreateApplicationBody',
  example: createApplicationExample,
});

export type Application = z.infer<typeof ApplicationFields>;
export type CreateApplicationBody = z.input<typeof CreateApplicationFields>;
