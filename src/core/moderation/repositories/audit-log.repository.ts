// Written with the help of Claude
import type { AuditEntry } from '../types/report.ts';

/** Administrator actions, kept for SEC-004. */
export abstract class AuditLogRepository {
  abstract record(entry: AuditEntry): Promise<void>;
}
