// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../core/common/domain-error.ts';
import { ApplicationsRepository } from '../../core/matching/repositories/applications.repository.ts';
import {
  afterEventPlans,
  type Application,
  type ApplicationRecord,
  type ApplicationStatus,
} from '../../core/matching/types/application.ts';
import { toCommunicationFormat, toDesiredCompany } from './desired-company.ts';
import type { AfterEventPlan, Application as ApplicationRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

const withPlans = { afterEventPlans: { select: { plan: true } } } as const;

type ApplicationWithPlans = ApplicationRow & { afterEventPlans: { plan: AfterEventPlan }[] };

@Injectable()
export class PrismaApplicationsRepository implements ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(application: ApplicationRecord): Promise<Application> {
    try {
      const row = await this.prisma.application.create({
        data: {
          userId: application.userId,
          sessionId: application.sessionId,
          desiredCompany: toDesiredCompany[application.desiredCompany],
          afterEventPlans: { create: application.afterEventPlans.map((plan) => ({ plan })) },
        },
        include: withPlans,
      });
      return toApplication(row);
    } catch (error) {
      // The service checks first; of two applications at once, the index stops the second.
      if (violatedIndex(error) === 'applications_user_id_session_id_active_key') {
        throw new DomainError('ALREADY_APPLIED', 'The user is already in the pool of this session');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Application | undefined> {
    const row = await this.prisma.application.findUnique({ where: { id }, include: withPlans });
    return row ? toApplication(row) : undefined;
  }

  async findByUserAndSession(userId: string, sessionId: string): Promise<Application[]> {
    const rows = await this.prisma.application.findMany({ where: { userId, sessionId }, include: withPlans });
    return rows.map(toApplication);
  }

  async findByUserWithStatus(userId: string, statuses: ApplicationStatus[]): Promise<Application[]> {
    const rows = await this.prisma.application.findMany({
      where: { userId, status: { in: statuses } },
      include: withPlans,
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
}

function toApplication(row: ApplicationWithPlans): Application {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    desiredCompany: toCommunicationFormat[row.desiredCompany],
    afterEventPlans: row.afterEventPlans
      .map(({ plan }) => plan)
      .sort((a, b) => afterEventPlans.indexOf(a) - afterEventPlans.indexOf(b)),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
