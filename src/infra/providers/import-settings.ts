// Written with the help of Claude
import { ARTWIZARD_BASE_URL } from './artwizard-event-provider.ts';
import { KARABAS_BASE_URL } from './karabas-event-provider.ts';
import { NOMINATIM_BASE_URL } from '../geocoding/nominatim-geocoder.ts';

export interface ImportSettings {
  userAgent: string;
  /** Least time between two requests to one site; robots.txt of Karabas asks for 1 s, Nominatim's policy too. */
  intervalMs: number;
  artWizardBaseUrl: string;
  karabasBaseUrl: string;
  nominatimBaseUrl: string;
  now: () => Date;
}

const DEFAULT_USER_AGENT = 'NearbyImport/1.0 (+https://github.com/ukma-fin-ssdm-2026/pun-intended-team)';
const DEFAULT_INTERVAL_MS = 1000;

/**
 * The import's settings beyond its database. Only `IMPORT_USER_AGENT` is meant for deployments; the base URLs,
 * `IMPORT_REQUEST_INTERVAL_MS` and `IMPORT_NOW` let the e2e tests point the import at a local server with saved
 * pages, and stay unset everywhere else.
 */
export function importSettings(env: NodeJS.ProcessEnv = process.env): ImportSettings {
  const intervalMs = env.IMPORT_REQUEST_INTERVAL_MS ? Number(env.IMPORT_REQUEST_INTERVAL_MS) : DEFAULT_INTERVAL_MS;
  if (!Number.isInteger(intervalMs) || intervalMs < 0) {
    throw new Error('IMPORT_REQUEST_INTERVAL_MS must be a whole number of milliseconds');
  }
  const fixedNow = env.IMPORT_NOW ? new Date(env.IMPORT_NOW) : undefined;
  if (fixedNow && Number.isNaN(fixedNow.getTime())) {
    throw new Error('IMPORT_NOW must be a date, e.g. 2026-11-03');
  }
  return {
    userAgent: env.IMPORT_USER_AGENT || DEFAULT_USER_AGENT,
    intervalMs,
    artWizardBaseUrl: env.ARTWIZARD_BASE_URL || ARTWIZARD_BASE_URL,
    karabasBaseUrl: env.KARABAS_BASE_URL || KARABAS_BASE_URL,
    nominatimBaseUrl: env.NOMINATIM_BASE_URL || NOMINATIM_BASE_URL,
    now: () => fixedNow ?? new Date(),
  };
}
