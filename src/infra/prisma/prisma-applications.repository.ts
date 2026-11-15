// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../core/common/domain-error.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { ApplicationsRepository } from '../../core/matching/repositories/applications.repository.ts';
import {
  afterEventPlans,
  type Application,
  type ApplicationRecord,
  type ApplicationStatus,
} from '../../core/matching/types/application.ts';
import { toCommunicationFormat, toDesiredCompany } from './desired-company.ts';
import type { AfterEventPlan, Application as ApplicationRow, Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

const withDaysAndPlans = {
  sessions: { select: { sessionId: true } },
  afterEventPlans: { select: { plan: true } },
} as const;

type ApplicationWithDaysAndPlans = ApplicationRow & {
  sessions: { sessionId: string }[];
  afterEventPlans: { plan: AfterEventPlan }[];
};

@Injectable()
export class PrismaApplicationsRepository implements ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(application: ApplicationRecord): Promise<Application> {
    try {
      const row = await this.prisma.application.create({
        data: {
          userId: application.userId,
          eventId: application.eventId,
          desiredCompany: toDesiredCompany[application.desiredCompany],
          sessions: { create: application.sessionIds.map((sessionId) => ({ sessionId })) },
          afterEventPlans: { create: application.afterEventPlans.map((plan) => ({ plan })) },
        },
        include: withDaysAndPlans,
      });
      return toApplication(row);
    } catch (error) {
      // The service checks first; of two applications at once, the index stops the second.
      if (violatedIndex(error) === 'applications_user_id_event_id_active_key') {
        throw new DomainError('ALREADY_APPLIED', 'The user is already in the pool of this event');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Application | undefined> {
    const row = await this.prisma.application.findUnique({ where: { id }, include: withDaysAndPlans });
    return row ? toApplication(row) : undefined;
  }

  async findByUserAndEvent(userId: string, eventId: string): Promise<Application[]> {
    const rows = await this.prisma.application.findMany({ where: { userId, eventId }, include: withDaysAndPlans });
    return rows.map(toApplication);
  }

  async findByUserWithStatus(userId: string, statuses: ApplicationStatus[]): Promise<Application[]> {
    const rows = await this.prisma.application.findMany({
      where: { userId, status: { in: statuses } },
      include: withDaysAndPlans,
    });
    return rows.map(toApplication);
  }

  async withdraw(id: string, from: ApplicationStatus[]): Promise<Application | undefined> {
    const { count } = await this.prisma.application.updateMany({
      where: { id, status: { in: from } },
      data: { status: 'withdrawn' },
    });
    return count === 0 ? undefined : this.findById(id);
  }

  async findBySessions(sessionIds: string[], statuses: ApplicationStatus[], tx?: Transaction): Promise<Application[]> {
    const rows = await this.client(tx).application.findMany({
      where: { status: { in: statuses }, sessions: { some: { sessionId: { in: sessionIds } } } },
      include: withDaysAndPlans,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toApplication);
  }

  async cancel(ids: string[], from: ApplicationStatus[], tx?: Transaction): Promise<void> {
    await this.client(tx).application.updateMany({
      where: { id: { in: ids }, status: { in: from } },
      data: { status: 'cancelled' },
    });
  }

  async removeDays(ids: string[], sessionIds: string[], tx?: Transaction): Promise<void> {
    await this.client(tx).applicationSession.deleteMany({
      where: { applicationId: { in: ids }, sessionId: { in: sessionIds } },
    });
  }

  async moveDay(fromSessionId: string, toSessionId: string, tx?: Transaction): Promise<void> {
    const client = this.client(tx);
    const waiting = await client.applicationSession.findMany({ where: { sessionId: fromSessionId } });
    // An application that waits on both keeps its one row for the new session.
    await client.applicationSession.createMany({
      data: waiting.map(({ applicationId }) => ({ applicationId, sessionId: toSessionId })),
      skipDuplicates: true,
    });
    await client.applicationSession.deleteMany({ where: { sessionId: fromSessionId } });
  }

  private client(tx?: Transaction): Prisma.TransactionClient {
    return (tx as unknown as Prisma.TransactionClient | undefined) ?? this.prisma;
  }
}

function toApplication(row: ApplicationWithDaysAndPlans): Application {
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
