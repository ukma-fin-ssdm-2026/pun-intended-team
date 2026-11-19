// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { DeviceToken } from '../types/device-token.ts';

/** The push tokens of the devices: the device_tokens table, which only the notifications module reads. */
export abstract class DeviceTokensRepository {
  /**
   * Stores the token for its session, one per session: another token of the session goes. A token already stored,
   * for any account or session, moves to this one; it is not an error.
   */
  abstract register(device: DeviceToken, tx?: Transaction): Promise<void>;

  abstract findByAccount(accountId: string, tx?: Transaction): Promise<DeviceToken[]>;

  abstract deleteBySession(sessionId: string, tx?: Transaction): Promise<void>;

  /** Deletes the tokens of every session of the account but `exceptSessionId`. */
  abstract deleteByAccount(accountId: string, exceptSessionId?: string, tx?: Transaction): Promise<void>;

  abstract deleteByPushTokens(pushTokens: string[], tx?: Transaction): Promise<void>;
}
