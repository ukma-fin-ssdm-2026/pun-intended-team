// Written with the help of Claude
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export interface GoogleSettings {
  /** OAuth client ids of the app builds; an ID token must be issued to one of them. */
  clientIds: string[];
  jwksUrl: URL;
}

/** Read at startup. Without client ids Google sign-in is off, which production refuses. */
export function loadGoogleSettings(env: NodeJS.ProcessEnv = process.env): GoogleSettings {
  const clientIds = (env.GOOGLE_CLIENT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');
  if (clientIds.length === 0 && env.NODE_ENV === 'production') {
    throw new Error('GOOGLE_CLIENT_IDS is not set: see .env.example');
  }
  return { clientIds, jwksUrl: new URL(env.GOOGLE_JWKS_URL || GOOGLE_JWKS_URL) };
}
