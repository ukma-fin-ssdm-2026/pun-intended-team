// Written with the help of Claude
declare const transactionBrand: unique symbol;

/**
 * An open database transaction. `core` only passes it on, so that work written to the database and the job that
 * follows from it commit or roll back together; `infra` knows what it is.
 */
export interface Transaction {
  readonly [transactionBrand]: true;
}
