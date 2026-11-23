// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { AccountsService } from '../../dist/core/identity/services/accounts.service.js';
import type { ImagesService, PreparedImage } from '../../dist/core/images/services/images.service.js';
import type { ImageRef } from '../../dist/core/images/types/image.js';
import type { InterestsRepository } from '../../dist/core/profiles/repositories/interests.repository.js';
import type { ProfilesRepository } from '../../dist/core/profiles/repositories/profiles.repository.js';
import { ageOn } from '../../dist/core/common/age.js';
import { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type {
  Interest,
  LinkedAccount,
  NewProfile,
  Profile,
  ProfileChanges,
  ProfileSummary,
} from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID, PHONE } from './fixtures/accounts.ts';
import { TODAY, useFixedClock } from './fixtures/clock.ts';

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

const DATE_OF_BIRTH = '2000-05-17';
// The day of an event, and DATE_OF_BIRTH's 26th birthday.
const EVENT_DAY = '2026-04-30';
const BIRTHDAY_2026 = '2026-05-17';
const HIKING: Interest = {
  id: 'f0000000-0000-4000-8000-000000000001',
  name: 'Походи в гори',
  group: 'Спорт і природа',
};
const JAZZ: Interest = { id: 'f0000000-0000-4000-8000-000000000002', name: 'Джаз', group: 'Музика' };
const TELEGRAM: LinkedAccount = { network: 'telegram', username: 'natalka' };

function aProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    accountId: ACCOUNT_ID,
    username: 'Natalka.Park',
    displayName: 'Natalka',
    description: '',
    occupation: '',
    communicationFormat: null,
    gender: null,
    genderDescription: null,
    sharePhone: false,
    interestIds: [],
    linkedAccounts: [],
    photoId: null,
    coverId: null,
    safetyNotice: 'not_acknowledged',
    ...overrides,
  };
}

const OLD_PHOTO_ID = 'a0000000-0000-4000-8000-000000000001';
const NEW_PHOTO_ID = 'a0000000-0000-4000-8000-000000000002';
const PHOTO: ImageRef = { id: NEW_PHOTO_ID, width: 512, height: 512, crop: null };
const UPLOAD = {
  content: new Uint8Array([1, 2, 3]),
  contentType: 'image/jpeg',
  crop: { left: 0, top: 0, width: 1, height: 1 },
};

function aProfileSummary(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return { accountId: ACCOUNT_ID, username: 'Natalka.Park', displayName: 'Natalka', photoId: null, ...overrides };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

/** ProfilesService with mocked storage; the saved profile is what the repository returns. */
function makeService() {
  const profilesRepository = {
    findSummaries: mock.fn((): Promise<ProfileSummary[]> => Promise.resolve([aProfileSummary()])),
    findByAccountId: mock.fn((): Promise<Profile | undefined> => Promise.resolve(aProfile())),
    findByAccountIds: mock.fn((): Promise<Profile[]> => Promise.resolve([aProfile()])),
    isUsernameTaken: mock.fn((): Promise<boolean> => Promise.resolve(false)),
    create: mock.fn((_accountId: string, profile: NewProfile) => Promise.resolve(aProfile(profile))),
    update: mock.fn((_accountId: string, changes: ProfileChanges) => Promise.resolve(aProfile(changes))),
    replaceInterests: mock.fn((_accountId: string, interestIds: string[]) =>
      Promise.resolve(aProfile({ interestIds })),
    ),
    replaceLinkedAccounts: mock.fn((_accountId: string, linkedAccounts: LinkedAccount[]) =>
      Promise.resolve(aProfile({ linkedAccounts })),
    ),
    setImage: mock.fn((_accountId: string, _slot: string, imageId: string | null) =>
      Promise.resolve(aProfile({ photoId: imageId })),
    ),
    acknowledgeSafetyNotice: mock.fn(() => Promise.resolve(aProfile({ safetyNotice: 'hidden' }))),
  };
  const prepared = {
    encoded: { content: new Uint8Array(), contentType: 'image/webp', width: 512, height: 512 },
    crop: null,
  };
  const imagesService = {
    prepare: mock.fn((): Promise<PreparedImage> => Promise.resolve(prepared)),
    save: mock.fn((): Promise<ImageRef> => Promise.resolve(PHOTO)),
    remove: mock.fn(() => Promise.resolve()),
    getRefs: mock.fn((ids: (string | null)[]) =>
      Promise.resolve(new Map(ids.includes(NEW_PHOTO_ID) ? [[NEW_PHOTO_ID, PHOTO]] : [])),
    ),
  };
  const tx = {} as Transaction;
  const transactions = { run: mock.fn(<T>(work: (tx: Transaction) => Promise<T>) => work(tx)) };
  const interestsRepository = { findAll: mock.fn(() => Promise.resolve([HIKING, JAZZ])) };
  const accountsService = {
    getDateOfBirth: mock.fn((): Promise<string | undefined> => Promise.resolve(DATE_OF_BIRTH)),
    getDatesOfBirth: mock.fn((accountIds: string[]) =>
      Promise.resolve(new Map(accountIds.map((accountId) => [accountId, DATE_OF_BIRTH]))),
    ),
    getPhone: mock.fn((): Promise<string | null> => Promise.resolve(PHONE)),
  };
  const service = new ProfilesService(
    profilesRepository as unknown as ProfilesRepository,
    interestsRepository as unknown as InterestsRepository,
    accountsService as unknown as AccountsService,
    imagesService as unknown as ImagesService,
    transactions as unknown as TransactionRunner,
  );
  return { service, profilesRepository, interestsRepository, accountsService, imagesService, tx };
}

describe('ProfilesService.getSummaries', () => {
  test('asks for each account once', async () => {
    const { service, profilesRepository } = makeService();

    await service.getSummaries([ACCOUNT_ID, OTHER_ACCOUNT_ID, ACCOUNT_ID]);

    assert.deepEqual(profilesRepository.findSummaries.mock.calls[0]?.arguments, [[ACCOUNT_ID, OTHER_ACCOUNT_ID]]);
  });

  test('keys summaries by account id and leaves out accounts without a profile', async () => {
    const { service, profilesRepository } = makeService();
    const summary = aProfileSummary();
    profilesRepository.findSummaries.mock.mockImplementation(() => Promise.resolve([summary]));

    const summaries = await service.getSummaries([ACCOUNT_ID, OTHER_ACCOUNT_ID]);

    assert.deepEqual([...summaries], [[summary.accountId, summary]]);
  });
});

describe('ProfilesService.getMatchingTraits', () => {
  test('gives each account its interests in the order of the list, its gender and its age on the day', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountIds.mock.mockImplementation(() =>
      Promise.resolve([
        aProfile({ interestIds: [JAZZ.id, HIKING.id], gender: 'female' }),
        aProfile({ accountId: OTHER_ACCOUNT_ID, interestIds: [JAZZ.id], gender: null }),
      ]),
    );

    const traits = await service.getMatchingTraits([ACCOUNT_ID, OTHER_ACCOUNT_ID], EVENT_DAY);

    assert.deepEqual(
      traits,
      new Map([
        [ACCOUNT_ID, { interests: [HIKING, JAZZ], gender: 'female', age: ageOn(EVENT_DAY, DATE_OF_BIRTH) }],
        [OTHER_ACCOUNT_ID, { interests: [JAZZ], gender: null, age: ageOn(EVENT_DAY, DATE_OF_BIRTH) }],
      ]),
    );
  });

  test('counts a birthday on the day of the event', async () => {
    const { service } = makeService();

    const traits = await service.getMatchingTraits([ACCOUNT_ID], BIRTHDAY_2026);

    assert.equal(traits.get(ACCOUNT_ID)?.age, 26);
  });

  test('reads each account once when the list repeats one, in the caller’s transaction', async () => {
    const { service, profilesRepository, interestsRepository, accountsService } = makeService();
    const tx = {} as Transaction;

    await service.getMatchingTraits([ACCOUNT_ID, ACCOUNT_ID], EVENT_DAY, tx);

    assert.deepEqual(profilesRepository.findByAccountIds.mock.calls[0]?.arguments, [[ACCOUNT_ID], tx]);
    assert.deepEqual(interestsRepository.findAll.mock.calls[0]?.arguments, [tx]);
    assert.deepEqual(accountsService.getDatesOfBirth.mock.calls[0]?.arguments, [[ACCOUNT_ID], tx]);
  });
});

// FR-019: a proposal shows the profile without contacts.
describe('ProfilesService.getPublicProfiles', () => {
  useFixedClock();

  test('gives the profile, age and interests, without the networks or the phone setting', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountIds.mock.mockImplementation(() =>
      Promise.resolve([
        aProfile({
          description: 'Jazz and long walks',
          occupation: 'Illustrator',
          sharePhone: true,
          interestIds: [JAZZ.id],
          linkedAccounts: [TELEGRAM],
        }),
      ]),
    );

    const profiles = await service.getPublicProfiles([ACCOUNT_ID]);

    assert.deepEqual(profiles.get(ACCOUNT_ID), {
      accountId: ACCOUNT_ID,
      username: 'Natalka.Park',
      displayName: 'Natalka',
      description: 'Jazz and long walks',
      occupation: 'Illustrator',
      age: ageOn(TODAY, DATE_OF_BIRTH),
      interests: [JAZZ],
      photo: null,
      cover: null,
    });
  });

  test('leaves out an account without a profile', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountIds.mock.mockImplementation(() => Promise.resolve([]));

    const profiles = await service.getPublicProfiles([ACCOUNT_ID]);

    assert.equal(profiles.size, 0);
  });

  test('reads the dates of birth of all the accounts at once', async () => {
    const { service, profilesRepository, accountsService } = makeService();
    profilesRepository.findByAccountIds.mock.mockImplementation(() =>
      Promise.resolve([aProfile(), aProfile({ accountId: OTHER_ACCOUNT_ID })]),
    );

    await service.getPublicProfiles([ACCOUNT_ID, OTHER_ACCOUNT_ID, ACCOUNT_ID]);

    assert.deepEqual(
      accountsService.getDatesOfBirth.mock.calls.map(({ arguments: args }) => args),
      [[[ACCOUNT_ID, OTHER_ACCOUNT_ID]]],
    );
    assert.equal(accountsService.getDateOfBirth.mock.callCount(), 0);
  });
});

// FR-019: a mutual match sees the contacts.
describe('ProfilesService.getContacts', () => {
  test('gives the linked networks with their links and the phone when the user shares it', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(aProfile({ sharePhone: true, linkedAccounts: [TELEGRAM] })),
    );

    const contacts = await service.getContacts(ACCOUNT_ID);

    assert.deepEqual(contacts, {
      phone: PHONE,
      linkedAccounts: [{ ...TELEGRAM, url: 'https://t.me/natalka' }],
    });
  });

  test('keeps the phone back when the user does not share it', async () => {
    const { service, profilesRepository, accountsService } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(aProfile({ sharePhone: false, linkedAccounts: [TELEGRAM] })),
    );

    const contacts = await service.getContacts(ACCOUNT_ID);

    assert.equal(contacts.phone, null);
    assert.equal(accountsService.getPhone.mock.callCount(), 0);
  });

  test('answers NOT_FOUND without a profile', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.getContacts(ACCOUNT_ID), isDomainError('NOT_FOUND'));
  });
});

// FR-032, SAFE-002
describe('ProfilesService.acknowledgeSafetyNotice', () => {
  test('records the acknowledgment and the choice not to see it again', async () => {
    const { service, profilesRepository } = makeService();

    const profile = await service.acknowledgeSafetyNotice(ACCOUNT_ID, true);

    assert.deepEqual(profilesRepository.acknowledgeSafetyNotice.mock.calls[0]?.arguments, [ACCOUNT_ID, true]);
    assert.equal(profile.safetyNotice, 'hidden');
  });

  test('answers NOT_FOUND without a profile', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.acknowledgeSafetyNotice(ACCOUNT_ID, false), isDomainError('NOT_FOUND'));
    assert.equal(profilesRepository.acknowledgeSafetyNotice.mock.callCount(), 0);
  });
});

describe('ProfilesService.hasAcknowledgedSafetyNotice', () => {
  const cases = [
    { title: 'is true once acknowledged', profile: aProfile({ safetyNotice: 'acknowledged' }), result: true },
    { title: 'is true when hidden', profile: aProfile({ safetyNotice: 'hidden' }), result: true },
    { title: 'is false before that', profile: aProfile(), result: false },
    { title: 'is false without a profile', profile: undefined, result: false },
  ];

  for (const { title, profile, result } of cases) {
    test(title, async () => {
      const { service, profilesRepository } = makeService();
      profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(profile));

      assert.equal(await service.hasAcknowledgedSafetyNotice(ACCOUNT_ID), result);
    });
  }
});

describe('ProfilesService.getOwn', () => {
  test('answers NOT_FOUND before the profile is created', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.getOwn(ACCOUNT_ID), isDomainError('NOT_FOUND'));
  });

  test('fails as a data error, not a DomainError, when the account has no date of birth', async () => {
    const { service, accountsService } = makeService();
    accountsService.getDateOfBirth.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(
      service.getOwn(ACCOUNT_ID),
      (error: unknown) => error instanceof Error && !(error instanceof DomainError),
    );
  });

  test('leaves a profile without a network incomplete', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(aProfile({ communicationFormat: 'friends', interestIds: [HIKING.id] })),
    );

    const profile = await service.getOwn(ACCOUNT_ID);

    assert.equal(profile.isComplete, false);
  });
});

// FR-002
describe('ProfilesService.isComplete', () => {
  const complete = {
    communicationFormat: 'friends' as const,
    gender: 'male' as const,
    interestIds: [HIKING.id],
    linkedAccounts: [TELEGRAM],
  };
  const cases = [
    { title: 'is true with a format, a gender, an interest and a network', profile: aProfile(complete), result: true },
    {
      title: 'is true with the gender "other" and its description',
      profile: aProfile({ ...complete, gender: 'other', genderDescription: 'Небінарна людина' }),
      result: true,
    },
    // Profiles made before genders were asked: matching needs one.
    { title: 'is false without a gender', profile: aProfile({ ...complete, gender: null }), result: false },
    {
      title: 'is false without a format',
      profile: aProfile({ ...complete, communicationFormat: null }),
      result: false,
    },
    { title: 'is false without an interest', profile: aProfile({ ...complete, interestIds: [] }), result: false },
    { title: 'is false without a network', profile: aProfile({ ...complete, linkedAccounts: [] }), result: false },
    { title: 'is false without a profile', profile: undefined, result: false },
  ];

  for (const { title, profile, result } of cases) {
    test(title, async () => {
      const { service, profilesRepository } = makeService();
      profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(profile));

      assert.equal(await service.isComplete(ACCOUNT_ID), result);
    });
  }
});

describe('ProfilesService.create', () => {
  useFixedClock();

  test('checks the username, saves the first step and returns the profile as not yet complete', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));
    const input: NewProfile = { username: 'Natalka.Park', displayName: 'Natalka' };

    const profile = await service.create(ACCOUNT_ID, input);

    assert.deepEqual(profilesRepository.isUsernameTaken.mock.calls[0]?.arguments, [input.username, undefined]);
    assert.deepEqual(profilesRepository.create.mock.calls[0]?.arguments, [ACCOUNT_ID, input]);
    assert.equal(profile.username, input.username);
    assert.equal(profile.displayName, input.displayName);
    assert.equal(profile.age, ageOn(TODAY, DATE_OF_BIRTH));
    assert.equal(profile.isComplete, false);
  });

  test('refuses an account that already has a profile and saves nothing', async () => {
    const { service, profilesRepository } = makeService();
    const input: NewProfile = { username: 'Natalka.Park', displayName: 'Natalka' };

    await assert.rejects(service.create(ACCOUNT_ID, input), isDomainError('PROFILE_EXISTS'));
    assert.equal(profilesRepository.create.mock.callCount(), 0);
  });
});

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

  test('saves the gender "other" with its description', async () => {
    const { service, profilesRepository } = makeService();
    const changes: ProfileChanges = { gender: 'other', genderDescription: 'Небінарна людина' };

    const profile = await service.update(ACCOUNT_ID, changes);

    assert.deepEqual(profilesRepository.update.mock.calls[0]?.arguments, [ACCOUNT_ID, changes]);
    assert.equal(profile.genderDescription, 'Небінарна людина');
  });

  test('drops a description sent with a gender other than "other"', async () => {
    const { service, profilesRepository } = makeService();

    await service.update(ACCOUNT_ID, { gender: 'female', genderDescription: 'Жінка' });

    assert.deepEqual(profilesRepository.update.mock.calls[0]?.arguments, [
      ACCOUNT_ID,
      { gender: 'female', genderDescription: undefined },
    ]);
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
  test('saves each interest once and completes a profile with a format, a gender and a network', async () => {
    const { service, profilesRepository } = makeService();
    const rest = { communicationFormat: 'friends' as const, gender: 'female' as const, linkedAccounts: [TELEGRAM] };
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(aProfile(rest)));
    profilesRepository.replaceInterests.mock.mockImplementation((_accountId: string, interestIds: string[]) =>
      Promise.resolve(aProfile({ ...rest, interestIds })),
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

describe('ProfilesService.replaceLinkedAccounts', () => {
  test('saves the networks and returns them with their profile links', async () => {
    const { service, profilesRepository } = makeService();

    const profile = await service.replaceLinkedAccounts(ACCOUNT_ID, [TELEGRAM]);

    assert.deepEqual(profilesRepository.replaceLinkedAccounts.mock.calls[0]?.arguments, [ACCOUNT_ID, [TELEGRAM]]);
    assert.deepEqual(profile.linkedAccounts, [{ ...TELEGRAM, url: 'https://t.me/natalka' }]);
  });

  test('keeps the bare handle of a nickname or a pasted link', async () => {
    const { service, profilesRepository } = makeService();

    await service.replaceLinkedAccounts(ACCOUNT_ID, [
      { network: 'telegram', username: ' @natalka ' },
      { network: 'instagram', username: 'https://www.instagram.com/natalka.park/' },
    ]);

    assert.deepEqual(profilesRepository.replaceLinkedAccounts.mock.calls[0]?.arguments, [
      ACCOUNT_ID,
      [
        { network: 'telegram', username: 'natalka' },
        { network: 'instagram', username: 'natalka.park' },
      ],
    ]);
  });

  test('refuses a username that does not fit its social network, names it and changes nothing', async () => {
    const { service, profilesRepository } = makeService();

    await assert.rejects(
      service.replaceLinkedAccounts(ACCOUNT_ID, [TELEGRAM, { network: 'instagram', username: 'instagram.com/p/xyz' }]),
      (error: unknown) =>
        error instanceof DomainError &&
        error.code === 'INVALID_SOCIAL_HANDLE' &&
        error.field === 'linkedAccounts.1.username',
    );
    assert.equal(profilesRepository.replaceLinkedAccounts.mock.callCount(), 0);
  });

  test('refuses an empty list and changes nothing', async () => {
    const { service, profilesRepository } = makeService();

    await assert.rejects(service.replaceLinkedAccounts(ACCOUNT_ID, []), isDomainError('CONTACT_REQUIRED'));
    assert.equal(profilesRepository.replaceLinkedAccounts.mock.callCount(), 0);
  });

  test('answers NOT_FOUND before the profile is created', async () => {
    const { service, profilesRepository } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.replaceLinkedAccounts(ACCOUNT_ID, [TELEGRAM]), isDomainError('NOT_FOUND'));
  });
});

describe('ProfilesService.setImage', () => {
  test('crops the upload as an avatar, points the profile at it and deletes the old picture in one transaction', async () => {
    const { service, profilesRepository, imagesService, tx } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(aProfile({ photoId: OLD_PHOTO_ID })),
    );

    const profile = await service.setImage(ACCOUNT_ID, 'photo', UPLOAD);

    assert.deepEqual(imagesService.prepare.mock.calls[0]?.arguments, ['profilePhoto', UPLOAD]);
    assert.equal(imagesService.save.mock.calls[0]?.arguments[2], tx);
    assert.deepEqual(profilesRepository.setImage.mock.calls[0]?.arguments, [ACCOUNT_ID, 'photo', NEW_PHOTO_ID, tx]);
    assert.deepEqual(imagesService.remove.mock.calls[0]?.arguments, [[OLD_PHOTO_ID], tx]);
    assert.deepEqual(profile.photo, PHOTO);
  });

  test('answers NOT_FOUND before the profile is created, without reading the picture', async () => {
    const { service, profilesRepository, imagesService } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.setImage(ACCOUNT_ID, 'cover', UPLOAD), isDomainError('NOT_FOUND'));
    assert.equal(imagesService.prepare.mock.callCount(), 0);
  });
});

describe('ProfilesService.removeImage', () => {
  test('clears the cover and deletes its picture', async () => {
    const { service, profilesRepository, imagesService, tx } = makeService();
    profilesRepository.findByAccountId.mock.mockImplementation(() =>
      Promise.resolve(aProfile({ coverId: OLD_PHOTO_ID })),
    );

    await service.removeImage(ACCOUNT_ID, 'cover');

    assert.deepEqual(profilesRepository.setImage.mock.calls[0]?.arguments, [ACCOUNT_ID, 'cover', null, tx]);
    assert.deepEqual(imagesService.remove.mock.calls[0]?.arguments, [[OLD_PHOTO_ID], tx]);
  });

  test('changes nothing without a picture', async () => {
    const { service, profilesRepository, imagesService } = makeService();

    await service.removeImage(ACCOUNT_ID, 'photo');

    assert.equal(profilesRepository.setImage.mock.callCount(), 0);
    assert.equal(imagesService.remove.mock.callCount(), 0);
  });
});
