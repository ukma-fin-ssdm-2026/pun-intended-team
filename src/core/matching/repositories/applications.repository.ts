// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { Application, ApplicationRecord, ApplicationStatus } from '../types/application.ts';

export abstract class ApplicationsRepository {
  /** Throws ALREADY_APPLIED when the user already has an active application for the event. */
  abstract create(application: ApplicationRecord, tx?: Transaction): Promise<Application>;

  /** The applications waiting in the pool of any of the sessions, oldest first. */
  abstract findPool(sessionIds: string[], tx: Transaction): Promise<Application[]>;

  abstract findById(id: string): Promise<Application | undefined>;

  abstract findByUserAndEvent(userId: string, eventId: string): Promise<Application[]>;

  abstract findByUserWithStatus(userId: string, statuses: ApplicationStatus[]): Promise<Application[]>;

  /** Withdraws the application if its status is still one of `from`; undefined if it changed meanwhile. */
  abstract withdraw(id: string, from: ApplicationStatus[]): Promise<Application | undefined>;
}
