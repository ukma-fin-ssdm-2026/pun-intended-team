// Written with the help of Claude
// Starts the built API (dist/) for the fault-injection tests, with keys of its own and no real database.
import assert from 'node:assert/strict';
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export interface ApiProcess {
  child: ChildProcess;
  url: string;
  output: () => string;
}

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

/** The API's environment with `databaseUrl`, and a cleanup that removes the keys written for it. */
export function apiEnvironment(databaseUrl: string): { env: NodeJS.ProcessEnv; cleanup: () => void } {
  const keysDir = mkdtempSync(path.join(tmpdir(), 'nearby-reliability-'));
  const keyFile = (name: string) => {
    const file = path.join(keysDir, name);
    writeFileSync(file, randomBytes(32).toString('base64url'));
    return file;
  };
  const jwtKeysFile = path.join(keysDir, 'jwt-keys.json');
  writeFileSync(
    jwtKeysFile,
    JSON.stringify({ keys: [{ kty: 'oct', alg: 'HS256', kid: 'test', k: randomBytes(32).toString('base64url') }] }),
  );
  // The API loads .env itself, but variables set here win, so a developer's .env cannot change the run.
  const env = {
    ...process.env,
    // Production mode so the run does not rewrite the committed OpenAPI spec.
    NODE_ENV: 'production',
    MESSAGING_PROVIDER: 'disabled',
    GOOGLE_JWKS_URL: '',
    TRUST_PROXY: '',
    MAIN_DATABASE_URL: databaseUrl,
    CODE_HMAC_KEY_FILE: keyFile('code-hmac.key'),
    CONTACT_HMAC_KEY_FILE: keyFile('contact-hmac.key'),
    DATA_ENCRYPTION_KEY_FILE: keyFile('data-encryption.key'),
    JWT_KEYS_FILE: jwtKeysFile,
    GOOGLE_CLIENT_IDS: 'reliability-test.apps.googleusercontent.com',
  };
  return { env, cleanup: () => rmSync(keysDir, { recursive: true, force: true }) };
}

/** Starts the built API; resolves once /health answers, healthy or not, since the database here is never real. */
export async function startApi(env: NodeJS.ProcessEnv): Promise<ApiProcess> {
  const port = await freePort();
  const url = `http://localhost:${port}`;
  let output = '';
  const child = spawn(process.execPath, ['dist/api/main.js'], {
    env: { ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The API exited with code ${child.exitCode}:\n${output}`);
    }
    try {
      await fetch(`${url}/health`);
      return { child, url, output: () => output };
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error('The API did not start within 15 s');
}

export async function stopApi(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await exited;
}

/**
 * Starts the built API with `variable` set to `value` and expects the start to stop with code 1, an error that
 * names the variable and quotes the value. Any other variable of `env` is left as it is, and PORT is a free one
 * unless it is the variable under test.
 */
export async function assertStartRefused(env: NodeJS.ProcessEnv, variable: string, value: string): Promise<void> {
  const start = promisify(execFile)(process.execPath, ['dist/api/main.js'], {
    env: { ...env, PORT: String(await freePort()), [variable]: value },
    // An API that starts instead is stopped after 10 s, and the test fails.
    timeout: 10_000,
  });

  await assert.rejects(start, (error: { code: unknown; stderr: string }) => {
    assert.equal(error.code, 1);
    // The name is checked as well as the value: Node itself refuses some bad ports, without naming the variable.
    assert.ok(error.stderr.includes(`${variable} must be `), error.stderr);
    assert.ok(error.stderr.includes(`got "${value}"`), error.stderr);
    return true;
  });
}
