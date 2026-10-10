// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { AuthService } from '../../../core/identity/services/auth.service.ts';
import type { AccessToken } from '../../../core/identity/types/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { AccessTokenResponse, RegisterBody, SignInBody, VerifyBody } from '../schemas/auth.ts';

const RegisterRequest = { body: RegisterBody } satisfies RequestSchemas;
const VerifyRequest = { body: VerifyBody } satisfies RequestSchemas;
const SignInRequest = { body: SignInBody } satisfies RequestSchemas;

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
      'Finish registration with the code, a password and the date of birth. Creates the account and signs in.',
    tags: ['Auth'],
    access: 'public',
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
    path: Routes.auth.guest,
    operationId: 'getGuestToken',
    summary: 'Get a guest token',
    description: 'Get a guest token: browse the catalog without an account.',
    tags: ['Auth'],
    access: 'public',
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
