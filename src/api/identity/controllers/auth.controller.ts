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
  GoogleIdTokenBody,
  RefreshSessionBody,
  SessionTokensResponse,
} from '../schemas/auth.ts';

const CompleteRegistrationRequest = { body: CompleteRegistrationBody } satisfies RequestSchemas;
const GoogleIdTokenRequest = { body: GoogleIdTokenBody } satisfies RequestSchemas;
const RefreshSessionRequest = { body: RefreshSessionBody } satisfies RequestSchemas;

// Not MCP tools (mcp: false): an agent cannot use a token it gets back.
// Phone registration, passwords and linking Google have no routes while sign-in is Google-only (ADR-004);
// AuthService keeps them, so restoring the routes brings them back.
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

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
      'Last registration step: the date of birth. Activates the account and signs in. ' +
      'Under 18, the registration is removed and the Google account can start again.',
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
    path: Routes.auth.google,
    operationId: 'signInWithGoogle',
    summary: 'Sign in with Google',
    description: 'Sign in with the Google account the user registered with `registerWithGoogle`.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: GoogleIdTokenRequest,
    responses: {
      200: { description: 'The tokens of a new session', schema: SessionTokensResponse },
      401: {
        description: '`INVALID_CREDENTIALS`: the ID token is invalid, or the Google account is not registered',
        schema: ErrorResponse,
      },
    },
  })
  async signInWithGoogle(@Input() { body }: RouteInput<typeof GoogleIdTokenRequest>): Promise<SessionTokensResponse> {
    return withType(await this.authService.signInWithGoogle(body.idToken));
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
