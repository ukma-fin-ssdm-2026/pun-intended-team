// Written with the help of Claude
// Stub data until the database is connected. Kept in memory: changes made
// through the API last until the server restarts.
import type { Caller } from '../../core/identity/types/caller.js';

export const accounts = {
  olena: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14',
  taras: 'd8e2b4c6-1a3f-4e5d-8b7c-9f0a2c4e6b18',
  filmClub: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c',
  newGallery: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
  admin: 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e',
} as const;

/** Demo tokens for Swagger UI and curl, until sign-in is implemented. */
export const sessions: Record<string, Caller> = {
  'stub-guest': { kind: 'guest' },
  'stub-user': { kind: 'account', accountId: accounts.olena, role: 'user' },
  'stub-user-2': { kind: 'account', accountId: accounts.taras, role: 'user' },
  'stub-org': { kind: 'account', accountId: accounts.filmClub, role: 'user' },
  'stub-org-pending': { kind: 'account', accountId: accounts.newGallery, role: 'user' },
  'stub-admin': { kind: 'account', accountId: accounts.admin, role: 'admin' },
};
