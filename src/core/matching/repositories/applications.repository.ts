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
  abstract withdraw(id: string, from: ApplicationStatus[], tx: Transaction): Promise<Application | undefined>;

  /** The applications with one of the statuses that list one of the sessions among their days. */
  abstract findBySessions(
    sessionIds: string[],
    statuses: ApplicationStatus[],
    tx?: Transaction,
  ): Promise<Application[]>;

  /** Cancels the applications whose status is still one of `from`. */
  abstract cancel(ids: string[], from: ApplicationStatus[], tx?: Transaction): Promise<void>;

  /** Takes the sessions out of the days of the applications. */
  abstract removeDays(ids: string[], sessionIds: string[], tx?: Transaction): Promise<void>;

  /** Every application waiting on `fromSessionId` waits on `toSessionId` instead. */
  abstract moveDay(fromSessionId: string, toSessionId: string, tx?: Transaction): Promise<void>;
}
