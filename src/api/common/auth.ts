// Written with the help of Claude
import { type CanActivate, createParamDecorator, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../core/identity/services/auth.service.js';
import type { AccountCaller, Caller } from '../../core/identity/types/caller.js';
import { ApiException } from './api-exception.js';

/**
 * Who may call an endpoint: anyone (`public`), a guest or a signed-in account
 * (`guest`, catalog reads), or a signed-in account only (`user`).
 */
export type Access = 'public' | 'guest' | 'user';

export const RequireAccess = Reflector.createDecorator<Access>();

const CALLER = Symbol('caller');

interface AuthenticatedRequest {
  headers: { authorization?: string };
  [CALLER]?: Caller;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.get(RequireAccess, context.getHandler()) ?? 'user';
    if (access === 'public') {
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(req.headers.authorization);
    const caller = token ? await this.authService.authenticate(token) : undefined;
    if (!caller) {
      throw new ApiException('UNAUTHENTICATED', 'A valid access token is required');
    }
    if (access === 'user' && caller.kind !== 'account') {
      throw new ApiException('UNAUTHENTICATED', 'Sign in to do this');
    }
    req[CALLER] = caller;
    return true;
  }
}

export const CurrentAccount = createParamDecorator((_data: unknown, context: ExecutionContext): AccountCaller => {
  const caller = context.switchToHttp().getRequest<AuthenticatedRequest>()[CALLER];
  if (caller?.kind !== 'account') {
    throw new Error("@CurrentAccount() is only available on endpoints with access: 'user'");
  }
  return caller;
});

function bearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
