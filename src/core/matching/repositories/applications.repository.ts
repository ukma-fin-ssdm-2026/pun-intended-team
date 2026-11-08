// Written with the help of Claude
import type { Application, ApplicationRecord, ApplicationStatus } from '../types/application.ts';

export abstract class ApplicationsRepository {
  /** Throws ALREADY_APPLIED when the user already has an active application for the session. */
  abstract create(application: ApplicationRecord): Promise<Application>;

  abstract findById(id: string): Promise<Application | undefined>;

  abstract findByUserAndSession(userId: string, sessionId: string): Promise<Application[]>;

  abstract findByUserWithStatus(userId: string, statuses: ApplicationStatus[]): Promise<Application[]>;

  /** Withdraws the application if its status is still one of `from`; undefined if it changed meanwhile. */
  abstract withdraw(id: string, from: ApplicationStatus[]): Promise<Application | undefined>;
}
