// Written with the help of Claude
export interface Registration {
  phone: string;
  code: string;
  /** YYYY-MM-DD. */
  dateOfBirth: string;
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
