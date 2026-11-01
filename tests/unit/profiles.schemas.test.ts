// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CreateProfileBody,
  ReplaceInterestsBody,
  ReplaceLinkedAccountsBody,
  UpdateProfileBody,
} from '../../dist/api/profiles/schemas/profiles.js';
import { rejectedIssues, rejectedPaths } from './fixtures/schemas.ts';

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const DISPLAY_NAME_MAX = 50;
const DESCRIPTION_MAX = 500;
const OCCUPATION_MAX = 100;
const INTERESTS_MAX = 30;
// FR-002: friends / dating / company for an event.
const COMMUNICATION_FORMATS = ['friends', 'dating', 'company'] as const;

function aCreateProfileBody(overrides: { username?: string; displayName?: string } = {}) {
  return { username: 'olena_k', displayName: 'Olena', ...overrides };
}

function interestIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `f0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
}

// FR-002
describe('CreateProfileBody', () => {
  const acceptedUsernames = [
    { label: `a username of ${USERNAME_MIN} characters`, username: 'a'.repeat(USERNAME_MIN) },
    { label: `a username of ${USERNAME_MAX} characters`, username: 'a'.repeat(USERNAME_MAX) },
    { label: 'a username with digits, a dot and an underscore', username: 'olena.k_1' },
  ];

  for (const { label, username } of acceptedUsernames) {
    test(`accepts ${label}`, () => {
      const body = aCreateProfileBody({ username });

      const result = CreateProfileBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  test('trims the spaces around a username', () => {
    const body = aCreateProfileBody({ username: ' olena_k ' });

    const result = CreateProfileBody.safeParse(body);

    assert.equal(result.success, true);
    assert.equal(result.data?.username, body.username.trim());
  });

  const rejectedUsernames = [
    { label: `a username of ${USERNAME_MIN - 1} characters`, username: 'a'.repeat(USERNAME_MIN - 1) },
    { label: `a username of ${USERNAME_MAX + 1} characters`, username: 'a'.repeat(USERNAME_MAX + 1) },
    { label: 'a username starting with a dot', username: '.olena' },
    { label: 'a username starting with an underscore', username: '_olena' },
    { label: 'a username with a space inside', username: 'olena k' },
    { label: 'a username in Cyrillic', username: 'олена' },
    { label: 'a username of spaces only', username: '     ' },
  ];

  for (const { label, username } of rejectedUsernames) {
    test(`rejects ${label} and points at username`, () => {
      const result = CreateProfileBody.safeParse(aCreateProfileBody({ username }));

      assert.deepEqual(rejectedPaths(result), [['username']]);
    });
  }

  const acceptedDisplayNames = [
    { label: 'a display name of 1 character', displayName: 'O' },
    { label: `a display name of ${DISPLAY_NAME_MAX} characters`, displayName: 'a'.repeat(DISPLAY_NAME_MAX) },
  ];

  for (const { label, displayName } of acceptedDisplayNames) {
    test(`accepts ${label}`, () => {
      const body = aCreateProfileBody({ displayName });

      const result = CreateProfileBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  test(`accepts a display name of ${DISPLAY_NAME_MAX} characters with spaces around it`, () => {
    const displayName = 'a'.repeat(DISPLAY_NAME_MAX);
    const body = aCreateProfileBody({ displayName: ` ${displayName} ` });

    const result = CreateProfileBody.safeParse(body);

    assert.equal(result.success, true);
    assert.equal(result.data?.displayName, displayName);
  });

  const rejectedDisplayNames = [
    { label: 'an empty display name', displayName: '' },
    { label: 'a display name of spaces only', displayName: '   ' },
    { label: `a display name of ${DISPLAY_NAME_MAX + 1} characters`, displayName: 'a'.repeat(DISPLAY_NAME_MAX + 1) },
  ];

  for (const { label, displayName } of rejectedDisplayNames) {
    test(`rejects ${label} and points at displayName`, () => {
      const result = CreateProfileBody.safeParse(aCreateProfileBody({ displayName }));

      assert.deepEqual(rejectedPaths(result), [['displayName']]);
    });
  }
});

// FR-002
describe('UpdateProfileBody', () => {
  const acceptedDescriptions = [
    { label: 'an empty description', description: '' },
    { label: `a description of ${DESCRIPTION_MAX} characters`, description: 'a'.repeat(DESCRIPTION_MAX) },
  ];

  for (const { label, description } of acceptedDescriptions) {
    test(`accepts ${label}`, () => {
      const body = { description };

      const result = UpdateProfileBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  test('accepts a description of spaces only as an empty one', () => {
    const body = { description: '   ' };

    const result = UpdateProfileBody.safeParse(body);

    assert.equal(result.success, true);
    assert.equal(result.data?.description, '');
  });

  test(`rejects a description of ${DESCRIPTION_MAX + 1} characters and points at description`, () => {
    const result = UpdateProfileBody.safeParse({ description: 'a'.repeat(DESCRIPTION_MAX + 1) });

    assert.deepEqual(rejectedPaths(result), [['description']]);
  });

  test(`accepts an occupation of ${OCCUPATION_MAX} characters`, () => {
    const body = { occupation: 'a'.repeat(OCCUPATION_MAX) };

    const result = UpdateProfileBody.safeParse(body);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, body);
  });

  test(`rejects an occupation of ${OCCUPATION_MAX + 1} characters and points at occupation`, () => {
    const result = UpdateProfileBody.safeParse({ occupation: 'a'.repeat(OCCUPATION_MAX + 1) });

    assert.deepEqual(rejectedPaths(result), [['occupation']]);
  });

  for (const communicationFormat of COMMUNICATION_FORMATS) {
    test(`accepts the communication format ${communicationFormat}`, () => {
      const body = { communicationFormat };

      const result = UpdateProfileBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  test('rejects an unknown communication format and points at communicationFormat', () => {
    const result = UpdateProfileBody.safeParse({ communicationFormat: 'anyone' });

    assert.deepEqual(rejectedPaths(result), [['communicationFormat']]);
  });

  const emptyBodies = [
    { label: 'an empty body', body: {} },
    { label: 'a body whose only field is undefined', body: { displayName: undefined } },
  ];

  for (const { label, body } of emptyBodies) {
    test(`rejects ${label} as a whole`, () => {
      const result = UpdateProfileBody.safeParse(body);

      assert.deepEqual(
        rejectedIssues(result).map(({ path, message }) => ({ path, message })),
        [{ path: [], message: 'Send at least one field to change' }],
      );
    });
  }
});

describe('ReplaceInterestsBody', () => {
  const accepted = [
    { label: 'an empty list', count: 0 },
    { label: `a list of ${INTERESTS_MAX} interests`, count: INTERESTS_MAX },
  ];

  for (const { label, count } of accepted) {
    test(`accepts ${label}`, () => {
      const body = { interestIds: interestIds(count) };

      const result = ReplaceInterestsBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  test(`rejects a list of ${INTERESTS_MAX + 1} interests and points at interestIds`, () => {
    const result = ReplaceInterestsBody.safeParse({ interestIds: interestIds(INTERESTS_MAX + 1) });

    assert.deepEqual(rejectedPaths(result), [['interestIds']]);
  });
});

describe('ReplaceLinkedAccountsBody', () => {
  test('accepts one of each social network and keeps the bare handles', () => {
    const result = ReplaceLinkedAccountsBody.safeParse({
      linkedAccounts: [
        { network: 'telegram', username: ' @olena_k ' },
        { network: 'instagram', username: 'https://instagram.com/olena.k' },
        { network: 'whatsapp', username: '+380 50 123 45 67' },
        { network: 'tiktok', username: '@olena.k' },
        { network: 'facebook', username: 'facebook.com/olena.k' },
      ],
    });

    assert.equal(result.success, true);
    assert.deepEqual(
      result.data?.linkedAccounts.map((item) => item.username),
      ['olena_k', 'olena.k', '380501234567', 'olena.k', 'olena.k'],
    );
  });

  // CONTACT_REQUIRED comes from the service, so an empty list passes validation.
  test('accepts an empty list', () => {
    assert.equal(ReplaceLinkedAccountsBody.safeParse({ linkedAccounts: [] }).success, true);
  });

  test('rejects the same social network twice and points at linkedAccounts', () => {
    const result = ReplaceLinkedAccountsBody.safeParse({
      linkedAccounts: [
        { network: 'telegram', username: 'olena_k' },
        { network: 'telegram', username: 'olena_k2' },
      ],
    });

    assert.deepEqual(rejectedPaths(result), [['linkedAccounts']]);
  });

  const rejectedItems = [
    { label: 'an unknown social network', item: { network: 'myspace', username: 'olena' }, path: 'network' },
    {
      label: 'a handle that does not fit the network',
      item: { network: 'telegram', username: 'ol' },
      path: 'username',
    },
    { label: 'an empty username', item: { network: 'instagram', username: '  ' }, path: 'username' },
  ];

  for (const { label, item, path } of rejectedItems) {
    test(`rejects ${label} and points at ${path}`, () => {
      const result = ReplaceLinkedAccountsBody.safeParse({ linkedAccounts: [item] });

      assert.deepEqual(rejectedPaths(result), [['linkedAccounts', 0, path]]);
    });
  }
});
