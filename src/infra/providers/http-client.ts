// Written with the help of Claude
import { setTimeout as sleep } from 'node:timers/promises';
import { Logger } from '@nestjs/common';

export interface HttpResponse {
  status: number;
  url: string;
  text: string;
}

/** What a provider adapter needs to read a page; tests pass one that serves saved pages. */
export interface HttpClient {
  /** The response, whatever its status. Throws when the server cannot be reached after the retries. */
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

export interface PoliteHttpClientOptions {
  userAgent: string;
  /** Least time from the start of one request to the start of the next (robots.txt `Crawl-delay`). */
  intervalMs: number;
  /** Path prefixes the site's robots.txt disallows; a request for one throws without being sent. */
  disallowedPaths?: string[];
  /** Retries after a network error, 429 or 5xx; the wait doubles from `backoffMs`. */
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
}

/** A client for crawling one site: one request at a time, at most one per interval, with a clear User-Agent. */
export class PoliteHttpClient implements HttpClient {
  private readonly logger = new Logger(PoliteHttpClient.name);
  private nextRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: PoliteHttpClientOptions) {}

  get(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
    const { pathname } = new URL(url);
    const disallowed = this.options.disallowedPaths?.find((prefix) => pathname.startsWith(prefix));
    if (disallowed) {
      return Promise.reject(new Error(`${url} is disallowed by robots.txt (${disallowed})`));
    }
    const response = this.queue.then(() => this.getWithRetries(url, headers));
    this.queue = response.catch(() => undefined);
    return response;
  }

  private async getWithRetries(url: string, headers: Record<string, string>): Promise<HttpResponse> {
    const { retries = 3, backoffMs = 1000 } = this.options;
    for (let attempt = 0; ; attempt++) {
      let failure: string;
      try {
        const response = await this.send(url, headers);
        if (response.status !== 429 && response.status < 500) {
          return response;
        }
        if (attempt >= retries) {
          return response;
        }
        failure = `status ${response.status}`;
      } catch (error) {
        if (attempt >= retries) {
          throw error;
        }
        failure = error instanceof Error ? error.message : String(error);
      }
      const wait = backoffMs * 2 ** attempt;
      this.logger.warn(`GET ${url} failed (${failure}); retrying in ${wait} ms`);
      await sleep(wait);
    }
  }

  private async send(url: string, headers: Record<string, string>): Promise<HttpResponse> {
    const wait = this.nextRequestAt - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    this.nextRequestAt = Date.now() + this.options.intervalMs;
    const response = await fetch(url, {
      headers: { 'user-agent': this.options.userAgent, ...headers },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 20_000),
    });
    return { status: response.status, url: response.url || url, text: await response.text() };
  }
}
