// Written with the help of Claude
/** Checks that the database answers a query. */
export abstract class DatabaseProbe {
  /** Resolves once the database has answered; rejects with the cause when it cannot be reached. */
  abstract ping(): Promise<void>;
}
