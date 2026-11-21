// Written with the help of Claude
/** The API answered a session renewal with an error other than 401, so the request that needed it was not sent. */
export class RefreshFailedError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string) {
    super(`Could not renew the session: the API answered ${status}`);
    this.name = 'RefreshFailedError';
    this.status = status;
    this.code = code;
  }
}
