// Written with the help of Claude
import { afterEventPlans, type Application } from '../../core/matching/types/application.ts';
import { toCommunicationFormat } from './desired-company.ts';
import type { AfterEventPlan, Application as ApplicationRow } from './generated/client.ts';

/** What an application row needs from its relations to become an `Application`. */
export const withDaysAndPlans = {
  sessions: { select: { sessionId: true } },
  afterEventPlans: { select: { plan: true } },
} as const;

export type ApplicationWithDaysAndPlans = ApplicationRow & {
  sessions: { sessionId: string }[];
  afterEventPlans: { plan: AfterEventPlan }[];
};

export function toApplication(row: ApplicationWithDaysAndPlans): Application {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    sessionIds: row.sessions.map(({ sessionId }) => sessionId),
    desiredCompany: toCommunicationFormat[row.desiredCompany],
    afterEventPlans: row.afterEventPlans
      .map(({ plan }) => plan)
      .sort((a, b) => afterEventPlans.indexOf(a) - afterEventPlans.indexOf(b)),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
