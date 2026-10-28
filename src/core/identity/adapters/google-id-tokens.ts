// Written with the help of Claude
/** Checks Google ID tokens from Google Sign-In on the device. */
export abstract class GoogleIdTokens {
  /** The Google account's subject id; undefined for an invalid, expired or foreign token. */
  abstract verify(idToken: string): Promise<string | undefined>;
}
