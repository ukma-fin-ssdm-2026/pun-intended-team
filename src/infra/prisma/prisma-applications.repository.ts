// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../core/common/domain-error.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { ApplicationsRepository } from '../../core/matching/repositories/applications.repository.ts';
import type { Application, ApplicationRecord, ApplicationStatus } from '../../core/matching/types/application.ts';
import { toApplication, withDaysAndPlans } from './application-rows.ts';
import { toDesiredCompany } from './desired-company.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';
import { violatedIndex } from './violated-index.ts';

@Injectable()
export class PrismaApplicationsRepository implements ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(application: ApplicationRecord, tx?: Transaction): Promise<Application> {
    const client = clientOf(this.prisma, tx);
    try {
      const row = await client.application.create({
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

  async findPool(sessionIds: string[], tx: Transaction): Promise<Application[]> {
    const rows = await clientOf(this.prisma, tx).application.findMany({
      where: { status: 'in_pool', sessions: { some: { sessionId: { in: sessionIds } } } },
      include: withDaysAndPlans,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toApplication);
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

  async withdraw(id: string, from: ApplicationStatus[], tx: Transaction): Promise<Application | undefined> {
    const client = clientOf(this.prisma, tx);
    const { count } = await client.application.updateMany({
      where: { id, status: { in: from } },
      data: { status: 'withdrawn' },
    });
    if (count === 0) {
      return undefined;
    }
    return toApplication(await client.application.findUniqueOrThrow({ where: { id }, include: withDaysAndPlans }));
  }
}
