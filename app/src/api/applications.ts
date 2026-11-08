// Written with the help of Claude
import { kyivDay } from '@/dates';
import {
  applicationsSession,
  applicationsState,
  putApplication,
  setApplicationsState,
  type Application,
} from '@/state/applications';

import { apiClient } from './client';
import { call, type ApiResult } from './public-client';
import type { components } from './schema';

export type ApplicationAnswers = Omit<components['schemas']['CreateApplicationBody'], 'date'>;

let request: { session: number; done: Promise<void> } | undefined;

// One request at a time per session, however many screens ask.
export function loadMyApplications() {
  const from = applicationsSession();
  if (request?.session === from) return request.done;
  const done = (async () => {
    setApplicationsState({ status: 'loading' }, from);
    const result = await call(() => apiClient.GET('/api/v1/me/applications'));
    setApplicationsState(result.ok ? { status: 'loaded', applications: result.data } : { status: 'error' }, from);
  })().finally(() => {
    if (request?.done === done) request = undefined;
  });
  request = { session: from, done };
  return done;
}

async function saved(result: Promise<ApiResult<Application>>) {
  const from = applicationsSession();
  const outcome = await result;
  if (outcome.ok) {
    if (applicationsState().status === 'loaded') putApplication(outcome.data, from);
    else void loadMyApplications();
  }
  return outcome;
}

// `date` picks the day of a multi-day event; a single-day event needs none.
export function applyToEvent(eventId: string, answers: ApplicationAnswers, date?: string) {
  return saved(
    call(() =>
      apiClient.POST('/api/v1/events/{id}/applications', {
        params: { path: { id: eventId } },
        body: { ...answers, ...(date && { date }) },
      }),
    ),
  );
}

export function withdrawApplication(id: string) {
  return saved(call(() => apiClient.POST('/api/v1/applications/{id}/withdraw', { params: { path: { id } } })));
}

// The API cannot edit an application, so new answers withdraw it and apply again for the same session. When the new
// application is refused, the old answers are sent again, so the user stays in the pool if the API allows it.
export async function changeAnswers(application: Application, answers: ApplicationAnswers) {
  const withdrawn = await withdrawApplication(application.id);
  if (!withdrawn.ok) return withdrawn;
  const date = kyivDay(new Date(application.sessionStartsAt));
  const applied = await applyToEvent(application.eventId, answers, date);
  if (!applied.ok) {
    const { desiredCompany, afterEventPlans } = application;
    await applyToEvent(application.eventId, { desiredCompany, afterEventPlans }, date);
  }
  return applied;
}
