// Written with the help of Claude
import { Controller, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '../../../core/identity/services/auth.service.ts';
import { SessionsService } from '../../../core/identity/services/sessions.service.ts';
import type { AccessToken, SessionTokens } from '../../../core/identity/types/auth.ts';
import type { AccountCaller, RegistrantCaller } from '../../../core/identity/types/caller.ts';
import { CurrentAccount, CurrentRegistrant } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import {
  AccessTokenResponse,
  CompleteRegistrationBody,
  ConfirmPasswordResetBody,
  GoogleIdTokenBody,
  PasswordResetBody,
  RefreshSessionBody,
  RegisterBody,
  SessionTokensResponse,
  SetPasswordBody,
  SignInBody,
  VerifyBody,
} from '../schemas/auth.ts';

const RegisterRequest = { body: RegisterBody } satisfies RequestSchemas;
const VerifyRequest = { body: VerifyBody } satisfies RequestSchemas;
const CompleteRegistrationRequest = { body: CompleteRegistrationBody } satisfies RequestSchemas;
const SignInRequest = { body: SignInBody } satisfies RequestSchemas;
const SetPasswordRequest = { body: SetPasswordBody } satisfies RequestSchemas;
const GoogleIdTokenRequest = { body: GoogleIdTokenBody } satisfies RequestSchemas;
const PasswordResetRequest = { body: PasswordResetBody } satisfies RequestSchemas;
const ConfirmPasswordResetRequest = { body: ConfirmPasswordResetBody } satisfies RequestSchemas;
const RefreshSessionRequest = { body: RefreshSessionBody } satisfies RequestSchemas;

// Not MCP tools (mcp: false): an agent cannot use a token it gets back, register sends a code,
// and an agent should not set a user's password.
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.register,
    operationId: 'register',
    summary: 'Start registration',
    description:
      'Start registration: sends a one-time code to the phone number. The answer is the same whether or not ' +
      'the number already has an account, and a code requested within a minute of the last one is silently not sent.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: RegisterRequest,
    responses: {
      202: { description: 'The code is on its way; it is valid for 10 minutes' },
      503: { description: '`PHONE_CODES_UNAVAILABLE`: codes to phone numbers are switched off', schema: ErrorResponse },
    },
  })
  async register(@Input() { body }: RouteInput<typeof RegisterRequest>): Promise<void> {
    await this.authService.register(body.phone);
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.verify,
    operationId: 'verify',
    summary: 'Verify the phone number',
    description:
      'Second registration step: check the code. Returns a registration token, valid for 15 minutes, ' +
      'that only `completeRegistration` accepts.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: VerifyRequest,
    responses: {
      200: { description: 'A registration token', schema: AccessTokenResponse },
      409: { description: 'The phone number is already registered', schema: ErrorResponse },
      422: {
        description: '`INVALID_CODE`: the code is wrong, expired, already used or failed 3 times',
        schema: ErrorResponse,
      },
    },
  })
  async verify(@Input() { body }: RouteInput<typeof VerifyRequest>): Promise<AccessTokenResponse> {
    return withType(await this.authService.verify(body));
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.googleRegister,
    operationId: 'registerWithGoogle',
    summary: 'Register with Google',
    description:
      'First registration step: check the Google ID token. Returns a registration token, valid for 15 minutes, ' +
      'that only `completeRegistration` accepts.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: GoogleIdTokenRequest,
    responses: {
      200: { description: 'A registration token', schema: AccessTokenResponse },
      409: {
        description: '`GOOGLE_ACCOUNT_TAKEN`: the Google account is already registered; sign in instead',
        schema: ErrorResponse,
      },
      422: {
        description: '`INVALID_GOOGLE_TOKEN`: the ID token is invalid, expired or issued to another app',
        schema: ErrorResponse,
      },
    },
  })
  async registerWithGoogle(@Input() { body }: RouteInput<typeof GoogleIdTokenRequest>): Promise<AccessTokenResponse> {
    return withType(await this.authService.registerWithGoogle(body.idToken));
  }

  @Endpoint({
    method: 'post',
    path: Routes.auth.completeRegistration,
    operationId: 'completeRegistration',
    summary: 'Finish registration',
    description:
      'Last registration step: the date of birth. Activates the account and signs in; add a sign-in method ' +
      'next with `setPassword`. Under 18, the registration is removed and the number can start again.',
    tags: ['Auth'],
    access: 'registrant',
    mcp: false,
    request: CompleteRegistrationRequest,
    responses: {
      200: { description: 'The account is active; the tokens of its first session', schema: SessionTokensResponse },
      404: { description: 'The registration was removed; start again', schema: ErrorResponse },
      409: { description: 'Registration is already complete', schema: ErrorResponse },
      422: { description: '`UNDERAGE`: younger than 18', schema: ErrorResponse },
    },
  })
  async completeRegistration(
    @CurrentRegistrant() registrant: RegistrantCaller,
    @Input() { body }: RouteInput<typeof CompleteRegistrationRequest>,
  ): Promise<SessionTokensResponse> {
    return withType(await this.authService.completeRegistration(registrant.accountId, body.dateOfBirth));
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.signIn,
    operationId: 'signIn',
    summary: 'Sign in with phone number and password',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: SignInRequest,
    responses: {
      200: { description: 'The tokens of a new session', schema: SessionTokensResponse },
      401: {
        description: '`INVALID_CREDENTIALS`: wrong phone number or password; it does not say which',
        schema: ErrorResponse,
      },
    },
  })
  async signIn(@Input() { body }: RouteInput<typeof SignInRequest>): Promise<SessionTokensResponse> {
    return withType(await this.authService.signIn(body.phone, body.password));
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.google,
    operationId: 'signInWithGoogle',
    summary: 'Sign in with Google',
    description: 'Sign in with a Google account the user linked earlier with `linkGoogle`.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: GoogleIdTokenRequest,
    responses: {
      200: { description: 'The tokens of a new session', schema: SessionTokensResponse },
      401: {
        description: '`INVALID_CREDENTIALS`: the ID token is invalid, or no account linked this Google account',
        schema: ErrorResponse,
      },
    },
  })
  async signInWithGoogle(@Input() { body }: RouteInput<typeof GoogleIdTokenRequest>): Promise<SessionTokensResponse> {
    return withType(await this.authService.signInWithGoogle(body.idToken));
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.passwordReset,
    operationId: 'requestPasswordReset',
    summary: 'Start a password reset',
    description:
      'Start a password reset: sends a one-time code to the phone number if it has an account. The answer is the ' +
      'same for any number, and a code requested within a minute of the last one is silently not sent.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: PasswordResetRequest,
    responses: {
      202: { description: 'If the number has an account, a code is on its way; it is valid for 10 minutes' },
      503: { description: '`PHONE_CODES_UNAVAILABLE`: codes to phone numbers are switched off', schema: ErrorResponse },
    },
  })
  async requestPasswordReset(@Input() { body }: RouteInput<typeof PasswordResetRequest>): Promise<void> {
    await this.authService.requestPasswordReset(body.phone);
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.passwordResetConfirm,
    operationId: 'resetPassword',
    summary: 'Finish a password reset',
    description:
      'Finish a password reset with the code and a new password, and sign in. Every other session of the account ends.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: ConfirmPasswordResetRequest,
    responses: {
      200: { description: 'The password is replaced; the tokens of a new session', schema: SessionTokensResponse },
      422: {
        description: '`INVALID_CODE`: the code is wrong, expired, already used or failed 3 times',
        schema: ErrorResponse,
      },
    },
  })
  async resetPassword(
    @Input() { body }: RouteInput<typeof ConfirmPasswordResetRequest>,
  ): Promise<SessionTokensResponse> {
    return withType(await this.authService.resetPassword(body));
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'put',
    path: Routes.account.password,
    operationId: 'setPassword',
    summary: 'Set or change your password',
    description:
      'Set a password to sign in with, right after registration, or change it. ' +
      'Changing an existing password needs the current one; wrong ones count towards the sign-in lockout. ' +
      'Every other session of the account ends; this one stays signed in.',
    tags: ['Auth'],
    access: 'user',
    mcp: false,
    request: SetPasswordRequest,
    responses: {
      204: { description: 'The password is set' },
      422: {
        description:
          '`WRONG_PASSWORD`: the account has a password and `currentPassword` is missing or wrong, ' +
          'or the account is locked after too many wrong passwords',
        schema: ErrorResponse,
      },
    },
  })
  async setPassword(
    @CurrentAccount() account: AccountCaller,
    @Input() { body }: RouteInput<typeof SetPasswordRequest>,
  ): Promise<void> {
    await this.authService.setPassword(account.accountId, account.sessionId, body.password, body.currentPassword);
  }

  @Endpoint({
    method: 'put',
    path: Routes.account.google,
    operationId: 'linkGoogle',
    summary: 'Link your Google account',
    description:
      'Link a Google account to sign in with from now on. Linking the same Google account again changes nothing.',
    tags: ['Auth'],
    access: 'user',
    mcp: false,
    request: GoogleIdTokenRequest,
    responses: {
      204: { description: 'The Google account is linked' },
      409: {
        description:
          '`GOOGLE_ACCOUNT_TAKEN`: another account linked this Google account. ' +
          '`GOOGLE_ALREADY_LINKED`: this account has another Google account linked.',
        schema: ErrorResponse,
      },
      422: { description: '`INVALID_GOOGLE_TOKEN`: the ID token is invalid or expired', schema: ErrorResponse },
    },
  })
  async linkGoogle(
    @CurrentAccount() account: AccountCaller,
    @Input() { body }: RouteInput<typeof GoogleIdTokenRequest>,
  ): Promise<void> {
    await this.authService.linkGoogle(account.accountId, body.idToken);
  }

  @Endpoint({
    method: 'post',
    path: Routes.auth.guest,
    operationId: 'getGuestToken',
    summary: 'Get a guest token',
    description: 'Get a guest token: browse the catalog without an account.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    responses: {
      200: { description: 'A guest access token', schema: AccessTokenResponse },
    },
  })
  async getGuestToken(): Promise<AccessTokenResponse> {
    return withType(await this.authService.issueGuestToken());
  }

  @UseGuards(ThrottlerGuard)
  @Endpoint({
    method: 'post',
    path: Routes.auth.refresh,
    operationId: 'refreshSession',
    summary: 'Renew the access token',
    description:
      'Renew the access token with the refresh token, without signing in again. The refresh token is replaced: ' +
      'keep the new one, since the old one no longer works, and using it again ends the session.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: RefreshSessionRequest,
    responses: {
      200: { description: 'A new access token and refresh token', schema: SessionTokensResponse },
      401: {
        description: '`INVALID_REFRESH_TOKEN`: the session expired, was ended, or the token was already used',
        schema: ErrorResponse,
      },
    },
  })
  async refreshSession(@Input() { body }: RouteInput<typeof RefreshSessionRequest>): Promise<SessionTokensResponse> {
    return withType(await this.sessionsService.refresh(body.refreshToken));
  }

  @Endpoint({
    method: 'post',
    path: Routes.auth.signOut,
    operationId: 'signOut',
    summary: 'Sign out',
    description: 'End this session: its access token and refresh token stop working at once.',
    tags: ['Auth'],
    access: 'user',
    mcp: false,
    responses: {
      204: { description: 'Signed out' },
    },
  })
  async signOut(@CurrentAccount() account: AccountCaller): Promise<void> {
    await this.sessionsService.end(account.sessionId);
  }
}

function withType<T extends AccessToken | SessionTokens>(token: T): T & { tokenType: 'Bearer' } {
  return { ...token, tokenType: 'Bearer' };
}
