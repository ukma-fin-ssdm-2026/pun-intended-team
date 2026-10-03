// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '../repositories/sessions.repository.js';
import type { Caller } from '../types/caller.js';

@Injectable()
export class AuthService {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  // For now the stub repository maps fixed tokens to callers. With real JWTs
  // this verifies the signature first, then looks up the session by its id.
  async authenticate(accessToken: string): Promise<Caller | undefined> {
    return this.sessionsRepository.findCaller(accessToken);
  }
}
