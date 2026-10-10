// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '../../core/identity/repositories/sessions.repository.ts';
import type { Caller } from '../../core/identity/types/caller.ts';
import { sessions } from './data.ts';

@Injectable()
export class StubSessionsRepository implements SessionsRepository {
  async findCaller(accessToken: string): Promise<Caller | undefined> {
    return sessions[accessToken];
  }
}
