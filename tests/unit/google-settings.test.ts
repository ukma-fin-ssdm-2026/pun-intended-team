// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadGoogleSettings } from '../../dist/infra/auth/google-settings.js';

describe('loadGoogleSettings', () => {
  test('reads a comma-separated list of client ids, ignoring blanks', () => {
    const settings = loadGoogleSettings({ GOOGLE_CLIENT_IDS: ' ios-client, android-client ,' });

    assert.deepEqual(settings.clientIds, ['ios-client', 'android-client']);
  });

  test("uses Google's published keys by default", () => {
    assert.equal(loadGoogleSettings({}).jwksUrl.href, 'https://www.googleapis.com/oauth2/v3/certs');
  });

  test('uses the key set GOOGLE_JWKS_URL names', () => {
    const settings = loadGoogleSettings({ GOOGLE_JWKS_URL: 'http://localhost:4999/jwks' });

    assert.equal(settings.jwksUrl.href, 'http://localhost:4999/jwks');
  });

  test('turns Google sign-in off without client ids outside production', () => {
    assert.deepEqual(loadGoogleSettings({ NODE_ENV: 'development' }).clientIds, []);
  });

  test('refuses to start in production without client ids', () => {
    assert.throws(() => loadGoogleSettings({ NODE_ENV: 'production' }), /GOOGLE_CLIENT_IDS/);
  });

  const productionWithOtherKeys = {
    NODE_ENV: 'production',
    GOOGLE_CLIENT_IDS: 'ios-client',
    GOOGLE_JWKS_URL: 'http://localhost:4999/jwks',
  };

  test('refuses another key set in production', () => {
    assert.throws(() => loadGoogleSettings(productionWithOtherKeys), /GOOGLE_JWKS_URL/);
  });

  test('takes another key set in production only when test adapters are allowed', () => {
    const settings = loadGoogleSettings({ ...productionWithOtherKeys, ALLOW_TEST_ADAPTERS: 'true' });

    assert.equal(settings.jwksUrl.href, 'http://localhost:4999/jwks');
  });
});
