// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { Application, ApplicationRecord, ApplicationStatus } from '../types/application.ts';

export abstract class ApplicationsRepository {
  /** Throws ALREADY_APPLIED when the user already has an active application for the event. */
  abstract create(application: ApplicationRecord, tx?: Transaction): Promise<Application>;

  /** The applications waiting in the pool of any of the sessions, oldest first. */
  abstract findPool(sessionIds: string[], tx: Transaction): Promise<Application[]>;

  abstract findById(id: string, tx?: Transaction): Promise<Application | undefined>;

  abstract findByUserAndEvent(userId: string, eventId: string): Promise<Application[]>;

  /** The user's applications with one of the statuses, and those with no match that the user has not dismissed. */
  abstract findListed(userId: string, statuses: ApplicationStatus[]): Promise<Application[]>;

  /** Withdraws the application if its status is still one of `from`; undefined if it changed meanwhile. */
  abstract withdraw(id: string, from: ApplicationStatus[], tx: Transaction): Promise<Application | undefined>;

  /** Moves the applications still in the pool to `no_match` (FR-018). */
  abstract markNoMatch(ids: string[], tx: Transaction): Promise<void>;

  /** Hides an application with no match from the user's list; false if it has another status. */
  abstract dismiss(id: string): Promise<boolean>;
}
