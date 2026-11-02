// Written with the help of Claude
import { z } from 'zod';
import { CalendarDate } from '../../common/schemas/common.ts';

const CompleteRegistrationFields = z.strictObject({
  dateOfBirth: CalendarDate.describe('Checked on the server: at least 18 years old'),
});

export const CompleteRegistrationBody = CompleteRegistrationFields.meta({
  id: 'CompleteRegistrationBody',
  example: { dateOfBirth: '2000-05-17' },
});

const GoogleIdTokenFields = z.strictObject({
  idToken: z.string().min(1).max(4096).describe('The ID token Google Sign-In returned on the device'),
});

export const GoogleIdTokenBody = GoogleIdTokenFields.meta({
  id: 'GoogleIdTokenBody',
  example: { idToken: 'eyJhbGciOiJSUzI1NiIs…' },
});

const AccessTokenFields = z.object({
  accessToken: z.string().describe('Send as `Authorization: Bearer <accessToken>`'),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().describe('Seconds until the token expires'),
});

export const AccessTokenResponse = AccessTokenFields.meta({
  id: 'AccessTokenResponse',
  example: { accessToken: 'eyJhbGciOiJIUzI1NiIs…', tokenType: 'Bearer', expiresIn: 3600 },
});

export type AccessTokenResponse = z.infer<typeof AccessTokenFields>;

const SessionTokensFields = AccessTokenFields.extend({
  refreshToken: z
    .string()
    .describe('Renews the access token with `refreshSession`; valid for 30 days, and replaced by every renewal'),
});

export const SessionTokensResponse = SessionTokensFields.meta({
  id: 'SessionTokensResponse',
  example: {
    accessToken: 'eyJhbGciOiJIUzI1NiIs…',
    tokenType: 'Bearer',
    expiresIn: 3600,
    refreshToken: '<session id>.<secret>',
  },
});

export type SessionTokensResponse = z.infer<typeof SessionTokensFields>;

const RefreshSessionFields = z.strictObject({
  refreshToken: z.string().min(1).max(256).describe('The refresh token from the last sign-in or renewal'),
});

export const RefreshSessionBody = RefreshSessionFields.meta({
  id: 'RefreshSessionBody',
  example: { refreshToken: '<session id>.<secret>' },
});
