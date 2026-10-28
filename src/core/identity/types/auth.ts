// Written with the help of Claude
export interface Registration {
  phone: string;
  code: string;
}

export interface PasswordReset {
  phone: string;
  code: string;
  password: string;
}

export interface AccessToken {
  accessToken: string;
  /** Seconds until the token expires. */
  expiresIn: number;
}

/** What a signed-in account gets: the refresh token renews the access token without signing in again (SEC-005). */
export interface SessionTokens extends AccessToken {
  refreshToken: string;
}
