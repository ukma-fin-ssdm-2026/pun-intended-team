// Written with the help of Claude
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
// The first byte names the format, so a later key rotation can tell old values from new ones.
const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Column encryption for personal data (SEC-003): AES-256-GCM, stored as version | IV | tag | ciphertext.
 * An encrypted value cannot be searched, so phone numbers are also stored as an HMAC to look them up by.
 */
export class PersonalDataCipher {
  constructor(
    private readonly encryptionKey: Buffer,
    private readonly hmacKey: Buffer,
  ) {}

  encrypt(text: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return toBytes(Buffer.concat([Buffer.of(VERSION), iv, cipher.getAuthTag(), ciphertext]));
  }

  /** Throws for a value encrypted with another key or changed after it was stored. */
  decrypt(stored: Uint8Array): string {
    const value = Buffer.from(stored);
    if (value[0] !== VERSION) {
      throw new Error(`Unknown encrypted value format ${value[0]}`);
    }
    const iv = value.subarray(1, 1 + IV_BYTES);
    const tag = value.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(value.subarray(1 + IV_BYTES + TAG_BYTES)), decipher.final()]).toString(
      'utf8',
    );
  }

  /** HMAC-SHA256: the same phone number always gives the same hash. */
  hash(text: string): Uint8Array<ArrayBuffer> {
    return toBytes(createHmac('sha256', this.hmacKey).update(text).digest());
  }
}

// Prisma's Bytes fields are Uint8Array<ArrayBuffer>; a Buffer may sit on a shared pool.
function toBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buffer);
}
