// Written with the help of Claude
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CodeHasher } from '../../core/identity/adapters/code-hasher.ts';

/** HMAC-SHA256 over `phone:code` with the key from CODE_HMAC_KEY_FILE. */
export class HmacCodeHasher implements CodeHasher {
  constructor(private readonly key: Buffer) {}

  hash(phone: string, code: string): string {
    return createHmac('sha256', this.key).update(`${phone}:${code}`).digest('base64url');
  }

  matches(phone: string, code: string, hash: string): boolean {
    const actual = Buffer.from(this.hash(phone, code));
    const expected = Buffer.from(hash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
