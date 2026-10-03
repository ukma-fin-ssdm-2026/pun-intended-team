// Written with the help of Claude
export type EventSource = 'organization' | 'import';

export type EventStatus = 'published' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  source: EventSource;
  status: EventStatus;
}
