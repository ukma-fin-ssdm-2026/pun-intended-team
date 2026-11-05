// Written with the help of Claude
/** A job as its handler receives it. */
export interface Job<Payload extends object = object> {
  id: string;
  name: string;
  payload: Payload;
}

/**
 * Throws to fail the job, which is then retried. Delivery is at-least-once, so a handler checks the current state
 * first and does nothing for a job whose work is already done or no longer wanted.
 */
export type JobHandler<Payload extends object = object> = (job: Job<Payload>) => Promise<void>;

/** When a job may start: at once (no options), after a delay, or at a given time. */
export type EnqueueOptions = { delayMs: number; runAt?: never } | { runAt: Date; delayMs?: never };
