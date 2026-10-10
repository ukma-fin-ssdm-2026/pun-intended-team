// Written with the help of Claude
import { type CanActivate, createParamDecorator, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../core/identity/services/auth.service.ts';
import type { AccountCaller, Caller } from '../../core/identity/types/caller.ts';
import { ApiException } from './api-exception.ts';

/**
 * Who may call an endpoint: anyone (`public`), a guest or a signed-in account
 * (`guest`, catalog reads), a signed-in account (`user`), or an administrator (`admin`).
 */
export type Access = 'public' | 'guest' | 'user' | 'admin';

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
    if (caller.kind !== 'account' && (access === 'user' || access === 'admin')) {
      throw new ApiException('UNAUTHENTICATED', 'Sign in to do this');
    }
    if (access === 'admin' && caller.kind === 'account' && caller.role !== 'admin') {
      throw new ApiException('NOT_FOUND', 'Not found');
    }
    req[CALLER] = caller;
    return true;
  }
}

export const CurrentAccount = createParamDecorator((_data: unknown, context: ExecutionContext): AccountCaller => {
  const caller = context.switchToHttp().getRequest<AuthenticatedRequest>()[CALLER];
  if (caller?.kind !== 'account') {
    throw new Error("@CurrentAccount() is only available on endpoints with access: 'user' or 'admin'");
  }
  return caller;
});

function bearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
