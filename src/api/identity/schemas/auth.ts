// Written with the help of Claude
import { z } from 'zod';
import { CalendarDate } from '../../common/schemas/common.ts';

const PhoneNumber = z
  .string()
  .regex(/^\+380\d{9}$/, 'A Ukrainian number in the +380XXXXXXXXX format')
  .meta({ id: 'PhoneNumber', description: 'Ukrainian number, E.164', example: '+380501110001' });

// ASVS v5 minimum; the maximum keeps hashing cheap to refuse.
const NewPassword = z.string().min(8).max(128).describe('8 to 128 characters');

const RegisterFields = z.strictObject({ phone: PhoneNumber });

export const RegisterBody = RegisterFields.meta({ id: 'RegisterBody', example: { phone: '+380501119999' } });

const VerifyFields = z.strictObject({
  phone: PhoneNumber,
  code: z
    .string()
    .regex(/^\d{6}$/, 'Six digits')
    .describe('The code sent to the phone'),
  dateOfBirth: CalendarDate.describe('Checked on the server: at least 18 years old'),
});

export const VerifyBody = VerifyFields.meta({
  id: 'VerifyBody',
  example: { phone: '+380501119999', code: '123456', dateOfBirth: '2000-05-17' },
});

// Not the rules for a new password, so a later rule change does not lock anyone out.
const CurrentPassword = z.string().min(1).max(128);

const SignInFields = z.strictObject({
  phone: PhoneNumber,
  password: CurrentPassword,
});

export const SignInBody = SignInFields.meta({
  id: 'SignInBody',
  example: { phone: '+380501110001', password: 'nearby-dev-password' },
});

const SetPasswordFields = z.strictObject({
  password: NewPassword,
  currentPassword: CurrentPassword.optional().describe('Required once the account has a password'),
});

export const SetPasswordBody = SetPasswordFields.meta({
  id: 'SetPasswordBody',
  example: { password: 'a new long passphrase', currentPassword: 'a long passphrase' },
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
