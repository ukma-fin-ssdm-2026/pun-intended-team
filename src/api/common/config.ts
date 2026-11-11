// Written with the help of Claude
import { existsSync } from 'node:fs';

// Local settings; variables already set in the environment win.
if (existsSync('.env')) {
  process.loadEnvFile();
}

/**
 * Read at startup like the database limits (REL-01): an unset or empty variable takes its default, anything
 * but a whole number from `min` to `max` stops the start.
 */
function readInteger(name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a whole number of at least ${min}, got "${value}"`);
  }
  if (Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}, got "${value}"`);
  }
  return Number(value);
}

// Single place for the port: both the server and the generated spec use it.
export const DEFAULT_PORT = 4100;

export const port = readInteger('PORT', DEFAULT_PORT, 1, 65535);

export const isProduction = process.env.NODE_ENV === 'production';

export const serveSwaggerUi = process.env.SWAGGER_UI === 'true' || !isProduction;

// Requests per minute per IP to each public sign-in and code endpoint (SEC-007, TM-08).
export const authRateLimitPerMinute = readInteger('AUTH_RATE_LIMIT_PER_MINUTE', 20, 1);

// The proxy whose X-Forwarded-For the per-IP limits trust: a hop count, or Express's addresses and
// subnets (`loopback`, `uniquelocal`, CIDRs). Unset trusts none.
export const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);

function parseTrustProxy(value: string | undefined): number | string | undefined {
  if (!value) {
    return undefined;
  }
  if (value === 'true') {
    throw new Error('TRUST_PROXY=true would let any client pick its own IP: set the proxy address or hop count');
  }
  return /^\d+$/.test(value) ? Number(value) : value;
}

export const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');
