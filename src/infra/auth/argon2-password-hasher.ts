// Written with the help of Claude
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../../core/identity/adapters/password-hasher.ts';

// The async variant runs on the libuv thread pool, so hashing does not block other requests.
const deriveKey = promisify(argon2);

// OWASP minimum for argon2id (SEC-002): 19 MiB, 2 passes, 1 lane.
const PARAMS = { memory: 19456, passes: 2, parallelism: 1 };
const SALT_BYTES = 16;
const HASH_BYTES = 32;

// PHC string format: $argon2id$v=19$m=<memory>,t=<passes>,p=<parallelism>$<salt>$<hash>, unpadded base64.
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const hash = await deriveKey('argon2id', {
      message: normalize(password),
      nonce: salt,
      tagLength: HASH_BYTES,
      ...PARAMS,
    });
    const { memory, passes, parallelism } = PARAMS;
    return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${base64(salt)}$${base64(hash)}`;
  }

  // Uses the parameters stored in the hash, so hashes made with older parameters still verify.
  async verify(hash: string, password: string): Promise<boolean> {
    const match = PHC.exec(hash);
    if (!match) {
      return false;
    }
    const [memory, passes, parallelism, salt, expected] = match.slice(1) as [string, string, string, string, string];
    const expectedHash = Buffer.from(expected, 'base64');
    const actualHash = await deriveKey('argon2id', {
      message: normalize(password),
      nonce: Buffer.from(salt, 'base64'),
      tagLength: expectedHash.length,
      memory: Number(memory),
      passes: Number(passes),
      parallelism: Number(parallelism),
    });
    return timingSafeEqual(actualHash, expectedHash);
  }
}

// The same password typed on different keyboards can arrive as different code points.
function normalize(password: string): string {
  return password.normalize('NFKC');
}

function base64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}
