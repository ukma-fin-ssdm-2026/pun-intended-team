// Written with the help of Claude
export interface Registration {
  phone: string;
  code: string;
  password: string;
  /** YYYY-MM-DD. */
  dateOfBirth: string;
}

export interface AccessToken {
  accessToken: string;
  /** Seconds until the token expires. */
  expiresIn: number;
}
