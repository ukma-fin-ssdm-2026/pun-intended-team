// Written with the help of Claude
export type AccountRole = 'user' | 'admin';

export interface AccountCaller {
  kind: 'account';
  accountId: string;
  role: AccountRole;
  sessionId: string;
}

export interface GuestCaller {
  kind: 'guest';
  guestId: string;
}

/** An account between a verified code and the age check; it can only finish registration. */
export interface RegistrantCaller {
  kind: 'registrant';
  accountId: string;
}

/** Who sent a request: a guest (an app install without an account), a registrant or a signed-in account. */
export type Caller = GuestCaller | RegistrantCaller | AccountCaller;
