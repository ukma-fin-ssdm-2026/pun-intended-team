// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { SECOND_MS } from '../../common/durations.ts';
import { DatabaseProbe } from '../adapters/database-probe.ts';
import type { DependencyStatus, Health } from '../types/health.ts';

// Below the 3 s timeout of the HEALTHCHECK in the Dockerfile, so Docker gets the answer instead of giving up.
export const HEALTH_CHECK_TIMEOUT_MS = 2 * SECOND_MS;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly database: DatabaseProbe) {}

  async check(): Promise<Health> {
    const database = await this.probe('database', () => this.database.ping());
    return { status: database === 'up' ? 'healthy' : 'unhealthy', checks: { database } };
  }

  /** The cause of a failure goes to the log only, never to the answer. */
  private async probe(name: string, ping: () => Promise<void>): Promise<DependencyStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no answer within ${HEALTH_CHECK_TIMEOUT_MS} ms`)),
        HEALTH_CHECK_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([ping(), timeout]);
      return 'up';
    } catch (error) {
      // Prisma's messages span several lines and start with an empty one.
      const cause = String((error as Error).message)
        .replace(/\s+/g, ' ')
        .trim();
      this.logger.error(`Health check: the ${name} is down: ${cause}`);
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
