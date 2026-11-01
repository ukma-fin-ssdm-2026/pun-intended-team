// Written with the help of Claude
// AI Usage: mock matching data from the Figma Stage 3 screens; reviewed by Daryna Halytska.
import { mockProfile } from '@/mocks/profile';

// The matching flow follows the jazz evening, as in Figma. Dates are shifted like the mock events (Figma's 15 жовт is
// 21 жовт here, 20 жовт is 26 жовт).
export const mockSearch = {
  eventId: '7a2d4b5c-0002-4b00-8000-000000000001',
  nextPick: 'Ср, 21 жовт · через 2 дні',
  round: 2,
  rounds: 4,
  roundsNote: 'останній за 6 год до події',
};

// The people of the matching mocks: Олена is the new proposal for the jazz evening (05, Т2), Максим the mutual match
// for the house concert (Т2, Т5 "Це взаємно!", 06, 07).
export type MatchPerson = {
  id: 'olena' | 'maksym';
  name: string;
  // Reports are sent for it, so they reach the API only when an account has this username.
  username: string;
  // Ukrainian forms the copy needs: "Поскаржитися на Олену", "Ви з Оленою", "Контакти Олени".
  accusative: string;
  instrumental: string;
  genitive: string;
  // "Олена теж прийняла метч!" / "Максим теж прийняв метч!".
  accepted: string;
  initial: string;
  nameAge: string;
  eventId: string;
  telegram: string;
  phone: string;
};

export const mockPeople: Record<MatchPerson['id'], MatchPerson> = {
  olena: {
    id: 'olena',
    name: 'Олена',
    username: 'olena',
    accusative: 'Олену',
    instrumental: 'Оленою',
    genitive: 'Олени',
    accepted: 'прийняла',
    initial: 'О',
    nameAge: 'Олена, 24',
    eventId: '7a2d4b5c-0002-4b00-8000-000000000001',
    telegram: '@olena_draws',
    phone: '+380 [НОМЕР]',
  },
  maksym: {
    id: 'maksym',
    name: 'Максим',
    username: 'maksym',
    accusative: 'Максима',
    instrumental: 'Максимом',
    genitive: 'Максима',
    accepted: 'прийняв',
    initial: 'М',
    nameAge: 'Максим, 26',
    eventId: '7a2d4b5c-0002-4b00-8000-000000000002',
    telegram: '@maksym_sounds',
    phone: '+380 [НОМЕР]',
  },
};

export const isMatchPersonId = (id: string | undefined): id is MatchPerson['id'] => id === 'olena' || id === 'maksym';

// The proposed match of 05.
export const mockPerson = mockPeople.olena;

// 05 Запропонований метч: the first of three proposals for the jazz evening.
export const mockProposal = {
  position: 'Нові метчі · 1 з 3',
  count: 3,
  next: 'Далі: ще 2 пропозиції',
  // Figma uses this photo as the user's cover.
  cover: require('@/assets/images/events/kvartyrnyk.png'),
  initial: 'О',
  nameAge: 'Олена, 24',
  occupation: 'Ілюстраторка',
  lookingFor: 'компанію на вечір',
  afterEvent: 'прогулянка, кава',
  validUntil: 'Ср, 21 жовт, 19:00',
  about:
    'Працюю в ілюстрації, люблю камерні концерти й довгі прогулянки після них. Шукаю компанію, з якою можна обговорити музику.',
  commonLabel: '· 3 спільних',
  interests: [
    { label: 'Джаз', common: true },
    { label: 'Сучасне мистецтво', common: true },
    { label: 'Лекції', common: true },
    { label: 'Кераміка', common: false },
    { label: 'Інді', common: false },
  ],
};

// 07 Взаємний метч: the user's own initial next to the match's.
export const mockMutual = { ownInitial: mockProfile.initial };

// Т2 Метчі: one card per event the user looks for company at, as in Figma.
export const mockMatchesTab = {
  subtitle: '3 події · 1 нова пропозиція',
  answeredSubtitle: '3 події · 2 чекають на відповідь',
  search: { eventId: '7a2d4b5c-0002-4b00-8000-000000000003', nextPick: 'Наступний підбір: Пн, 26 жовт' },
  // Т2.2 after accepting (05.2) and after declining (05.3).
  toast: {
    accepted: { title: 'Готово! Ти прийняла 2 метчі', note: 'Штурхнемо, щойно хтось відповість' },
    declined: { title: 'Шукаємо тобі нову компанію', note: 'Штурхнемо, щойно хтось відповість' },
  },
};
