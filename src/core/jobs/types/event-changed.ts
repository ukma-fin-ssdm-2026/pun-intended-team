// Written with the help of Claude
/** The job the catalog and the import enqueue when an event changes for its applicants; matching consumes it (HLD I3). */
export const EVENT_CHANGED_JOB = 'event.changed';

/**
 * What happened to the event: it was cancelled, published again after a cancellation, or its sessions start at other
 * times or on other days. Only says why the job exists: the consumer reads the event as it is now.
 */
export type EventChange = 'cancelled' | 'republished' | 'rescheduled';

export interface EventChangedPayload {
  eventId: string;
  change: EventChange;
}
