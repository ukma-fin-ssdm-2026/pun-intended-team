// Written with the help of Claude
/** Slow one-way hashing for passwords (SEC-002). */
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;

  /** False for a wrong password and for a hash it cannot parse. */
  abstract verify(hash: string, password: string): Promise<boolean>;
}
