// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { AuthService } from '../../../core/identity/services/auth.service.ts';
import type { AccessToken } from '../../../core/identity/types/auth.ts';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import {
  AccessTokenResponse,
  ConfirmPasswordResetBody,
  PasswordResetBody,
  RegisterBody,
  SetPasswordBody,
  SignInBody,
  VerifyBody,
} from '../schemas/auth.ts';

const RegisterRequest = { body: RegisterBody } satisfies RequestSchemas;
const VerifyRequest = { body: VerifyBody } satisfies RequestSchemas;
const SignInRequest = { body: SignInBody } satisfies RequestSchemas;
const SetPasswordRequest = { body: SetPasswordBody } satisfies RequestSchemas;
const PasswordResetRequest = { body: PasswordResetBody } satisfies RequestSchemas;
const ConfirmPasswordResetRequest = { body: ConfirmPasswordResetBody } satisfies RequestSchemas;

// Not MCP tools (mcp: false): an agent cannot use a token it gets back, register sends a code,
// and an agent should not set a user's password.
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Endpoint({
    method: 'post',
    path: Routes.auth.register,
    operationId: 'register',
    summary: 'Start registration',
    description:
      'Start registration: sends a one-time code to the phone number. The answer is the same whether or not ' +
      'the number already has an account.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: RegisterRequest,
    responses: {
      202: { description: 'The code is on its way; it is valid for 10 minutes' },
      429: { description: '`CODE_RESEND_TOO_SOON`: a code was sent less than a minute ago', schema: ErrorResponse },
    },
  })
  async register(@Input() { body }: RouteInput<typeof RegisterRequest>): Promise<void> {
    await this.authService.register(body.phone);
  }

  @Endpoint({
    method: 'post',
    path: Routes.auth.verify,
    operationId: 'verify',
    summary: 'Finish registration',
    description:
      'Finish registration with the code and the date of birth. Creates the account and signs in; ' +
      'add a sign-in method next with `setPassword`.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: VerifyRequest,
    responses: {
      200: { description: 'The account is created; an access token for it', schema: AccessTokenResponse },
      409: { description: 'The phone number is already registered', schema: ErrorResponse },
      422: {
        description:
          '`INVALID_CODE`: the code is wrong, expired, already used or failed 3 times. ' +
          '`UNDERAGE`: younger than 18.',
        schema: ErrorResponse,
      },
    },
  })
  async verify(@Input() { body }: RouteInput<typeof VerifyRequest>): Promise<AccessTokenResponse> {
    return withType(await this.authService.verify(body));
  }

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
      200: { description: 'An access token', schema: AccessTokenResponse },
      401: {
        description: '`INVALID_CREDENTIALS`: wrong phone number or password; it does not say which',
        schema: ErrorResponse,
      },
    },
  })
  async signIn(@Input() { body }: RouteInput<typeof SignInRequest>): Promise<AccessTokenResponse> {
    return withType(await this.authService.signIn(body.phone, body.password));
  }

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
    },
  })
  async requestPasswordReset(@Input() { body }: RouteInput<typeof PasswordResetRequest>): Promise<void> {
    await this.authService.requestPasswordReset(body.phone);
  }

  @Endpoint({
    method: 'post',
    path: Routes.auth.passwordResetConfirm,
    operationId: 'resetPassword',
    summary: 'Finish a password reset',
    description: 'Finish a password reset with the code and a new password, and sign in.',
    tags: ['Auth'],
    access: 'public',
    mcp: false,
    request: ConfirmPasswordResetRequest,
    responses: {
      200: { description: 'The password is replaced; an access token', schema: AccessTokenResponse },
      422: {
        description: '`INVALID_CODE`: the code is wrong, expired, already used or failed 3 times',
        schema: ErrorResponse,
      },
    },
  })
  async resetPassword(@Input() { body }: RouteInput<typeof ConfirmPasswordResetRequest>): Promise<AccessTokenResponse> {
    return withType(await this.authService.resetPassword(body));
  }

  @Endpoint({
    method: 'put',
    path: Routes.account.password,
    operationId: 'setPassword',
    summary: 'Set or change your password',
    description:
      'Set a password to sign in with, right after registration, or change it. ' +
      'Changing an existing password needs the current one.',
    tags: ['Auth'],
    access: 'user',
    mcp: false,
    request: SetPasswordRequest,
    responses: {
      204: { description: 'The password is set' },
      422: {
        description: '`WRONG_PASSWORD`: the account has a password and `currentPassword` is missing or wrong',
        schema: ErrorResponse,
      },
    },
  })
  async setPassword(
    @CurrentAccount() account: AccountCaller,
    @Input() { body }: RouteInput<typeof SetPasswordRequest>,
  ): Promise<void> {
    await this.authService.setPassword(account.accountId, body.password, body.currentPassword);
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
}

function withType(token: AccessToken): AccessTokenResponse {
  return { ...token, tokenType: 'Bearer' };
}
