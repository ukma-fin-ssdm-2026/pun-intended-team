// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { AccountsService } from '../../dist/core/identity/services/accounts.service.js';
import type { InterestsRepository } from '../../dist/core/profiles/repositories/interests.repository.js';
import type { ProfilesRepository } from '../../dist/core/profiles/repositories/profiles.repository.js';
import { ageOn, ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { Interest, Profile, ProfileChanges } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';

describe('ageOn', () => {
  const cases = [
    { today: '2026-10-15', dateOfBirth: '2008-10-15', age: 18, title: 'counts the birthday itself as a full year' },
    { today: '2026-10-14', dateOfBirth: '2008-10-15', age: 17, title: 'stays a year younger the day before' },
    { today: '2026-10-15', dateOfBirth: '2008-11-01', age: 17, title: 'stays a year younger before a later month' },
    { today: '2026-10-15', dateOfBirth: '2008-03-20', age: 18, title: 'counts a birthday in an earlier month' },
    // The same rule as registration: a 29 February birthday counts from 1 March (SAFE-001).
    { today: '2026-02-28', dateOfBirth: '2008-02-29', age: 17, title: 'waits for 1 March after a 29 February birth' },
    { today: '2026-03-01', dateOfBirth: '2008-02-29', age: 18, title: 'counts a 29 February birthday on 1 March' },
    { today: '2028-02-29', dateOfBirth: '2008-02-29', age: 20, title: 'counts a 29 February birthday in a leap year' },
    { today: '2026-10-15', dateOfBirth: '2026-10-15', age: 0, title: 'gives 0 on the day of birth' },
  ];

  for (const { today, dateOfBirth, age, title } of cases) {
    test(title, () => {
      assert.equal(ageOn(today, dateOfBirth), age);
    });
  }
});

const HIKING: Interest = { id: 'f0000000-0000-4000-8000-000000000001', name: 'Hiking' };
const JAZZ: Interest = { id: 'f0000000-0000-4000-8000-000000000002', name: 'Jazz' };

function aProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    accountId: ACCOUNT_ID,
    username: 'Natalka.Park',
    displayName: 'Natalka',
    description: '',
    communicationFormat: null,
    sharePhone: false,
    interestIds: [],
    ...overrides,
  };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

/** ProfilesService with mocked storage; the saved profile is what the repository returns. */
function makeService() {
  const profilesRepository = {
    findByAccountId: mock.fn((): Promise<Profile | undefined> => Promise.resolve(aProfile())),
    isUsernameTaken: mock.fn((): Promise<boolean> => Promise.resolve(false)),
    update: mock.fn((_accountId: string, changes: ProfileChanges) => Promise.resolve(aProfile(changes))),
    replaceInterests: mock.fn((_accountId: string, interestIds: string[]) =>
      Promise.resolve(aProfile({ interestIds })),
    ),
  };
  const interestsRepository = { findAll: mock.fn(() => Promise.resolve([HIKING, JAZZ])) };
  const accountsService = { getDateOfBirth: mock.fn(() => Promise.resolve('2000-05-17')) };
  const service = new ProfilesService(
    profilesRepository as unknown as ProfilesRepository,
    interestsRepository as unknown as InterestsRepository,
    accountsService as unknown as AccountsService,
  );
  return { service, profilesRepository };
}

// FR-002
describe('ProfilesService.update', () => {
  test('saves only the fields sent and returns the profile with them', async () => {
    const { service, profilesRepository } = makeService();
    const changes: ProfileChanges = { description: 'Walks and films.', communicationFormat: 'friends' };

    const profile = await service.update(ACCOUNT_ID, changes);

    assert.deepEqual(profilesRepository.update.mock.calls[0]?.arguments, [ACCOUNT_ID, changes]);
    assert.equal(profile.description, 'Walks and films.');
    assert.equal(profile.communicationFormat, 'friends');
    assert.equal(profile.username, 'Natalka.Park');
  });

  test('does not check the username when it is not changed', async () => {
    const { service, profilesRepository } = makeService();

    await service.update(ACCOUNT_ID, { sharePhone: true });

    assert.equal(profilesRepository.isUsernameTaken.mock.callCount(), 0);
  });

  test('checks a new username against other accounts only, so the owner may change its case', async () => {
    const { service, profilesRepository } = makeService();

    await service.update(ACCOUNT_ID, { username: 'natalka.park' });

    assert.deepEqual(profilesRepository.isUsernameTaken.mock.calls[0]?.arguments, ['natalka.park', ACCOUNT_ID]);
    assert.equal(profilesRepository.update.mock.callCount(), 1);
  });

  test('refuses a username another account has and saves nothing', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.isUsernameTaken.mock.mockImplementation(() => Promise.resolve(true));

    await assert.rejects(service.update(ACCOUNT_ID, { username: 'Taken' }), isDomainError('USERNAME_TAKEN'));
    assert.equal(profilesRepository.update.mock.callCount(), 0);
  });

  test('answers NOT_FOUND before the profile is created and saves nothing', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.update(ACCOUNT_ID, { description: 'x' }), isDomainError('NOT_FOUND'));
    assert.equal(profilesRepository.update.mock.callCount(), 0);
  });
});

describe('ProfilesService.replaceInterests', () => {
  test('saves each interest once and completes a profile with a communication format', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(aProfile({ communicationFormat: 'friends' })),
    );
    profilesRepository.replaceInterests.mock.mockImplementation((_accountId: string, interestIds: string[]) =>
      Promise.resolve(aProfile({ communicationFormat: 'friends', interestIds })),
    );

    const profile = await service.replaceInterests(ACCOUNT_ID, [HIKING.id, JAZZ.id, HIKING.id]);

    assert.deepEqual(profilesRepository.replaceInterests.mock.calls[0]?.arguments, [ACCOUNT_ID, [HIKING.id, JAZZ.id]]);
    assert.deepEqual(profile.interests, [HIKING, JAZZ]);
    assert.equal(profile.isComplete, true);
  });

  test('refuses an unknown interest and changes nothing', async () => {
    const { service, profilesRepository } = makeService();
    const unknownId = 'f0000000-0000-4000-8000-0000000000ff';

    await assert.rejects(
      service.replaceInterests(ACCOUNT_ID, [HIKING.id, unknownId]),
      isDomainError('REFERENCE_NOT_FOUND'),
    );
    assert.equal(profilesRepository.replaceInterests.mock.callCount(), 0);
  });
});
