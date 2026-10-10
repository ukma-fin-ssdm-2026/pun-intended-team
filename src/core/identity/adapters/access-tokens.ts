// Written with the help of Claude
import type { Caller } from '../types/caller.ts';

/** Signed, self-contained access tokens (SEC-005). */
export abstract class AccessTokens {
  abstract issue(caller: Caller, lifetimeSeconds: number): Promise<string>;

  /** The caller a token stands for; undefined for an expired, tampered or otherwise invalid token. */
  abstract verify(token: string): Promise<Caller | undefined>;
}
