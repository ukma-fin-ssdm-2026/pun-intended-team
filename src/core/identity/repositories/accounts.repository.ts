// Written with the help of Claude
export abstract class AccountsRepository {
  /** The account's date of birth as YYYY-MM-DD; undefined for an unknown account. */
  abstract findDateOfBirth(accountId: string): Promise<string | undefined>;
}
