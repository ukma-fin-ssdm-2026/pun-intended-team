// Written with the help of Claude
import type { Caller } from '../types/caller.ts';

export abstract class SessionsRepository {
  /** The caller a token belongs to; undefined for an unknown, expired or revoked token. */
  abstract findCaller(accessToken: string): Promise<Caller | undefined>;
}
