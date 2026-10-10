// Written with the help of Claude
/** Keyed hashing for verification codes, so stored codes are useless without the key (SEC-008). */
export abstract class CodeHasher {
  /** A code is bound to the phone it was sent to. */
  abstract hash(phone: string, code: string): string;

  abstract matches(phone: string, code: string, hash: string): boolean;
}
