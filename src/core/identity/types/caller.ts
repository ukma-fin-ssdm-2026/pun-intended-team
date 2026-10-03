// Written with the help of Claude
export type AccountRole = 'user' | 'admin';

export interface AccountCaller {
  kind: 'account';
  accountId: string;
  role: AccountRole;
}

/** Who sent a request: a guest (an app install without an account) or a signed-in account. */
export type Caller = { kind: 'guest' } | AccountCaller;
