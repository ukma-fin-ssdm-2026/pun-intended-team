// Written with the help of Claude
// AI Usage: mock matching data from the Figma Stage 3 screens; reviewed by Daryna Halytska.

// The matching flow follows the jazz evening, as in Figma. Dates are shifted like the mock events (Figma's 15 жовт is
// 21 жовт here, 20 жовт is 26 жовт).
export const mockSearch = {
  eventId: '7a2d4b5c-0002-4b00-8000-000000000001',
  nextPick: 'Ср, 21 жовт · через 2 дні',
  round: 2,
  rounds: 4,
  roundsNote: 'останній за 6 год до події',
};

// The proposed match (05) and, once both agree, the mutual one (07), as in Figma.
export const mockPerson = {
  name: 'Олена',
  // Ukrainian forms the copy needs: "Поскаржитися на Олену", "Ви з Оленою", "Контакти Олени".
  accusative: 'Олену',
  instrumental: 'Оленою',
  genitive: 'Олени',
};

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

// 07 Взаємний метч: the user's own initial next to the match's, and the match's contacts.
export const mockMutual = {
  ownInitial: 'Д',
  telegram: '@olena_draws',
  phone: '+380 [НОМЕР]',
};

// Т2 Метчі: one card per event the user looks for company at, as in Figma.
export const mockMatchesTab = {
  subtitle: '3 події · 1 нова пропозиція',
  answeredSubtitle: '3 події · 2 чекають на відповідь',
  mutual: { eventId: '7a2d4b5c-0002-4b00-8000-000000000002', initial: 'М', nameAge: 'Максим, 26' },
  search: { eventId: '7a2d4b5c-0002-4b00-8000-000000000003', nextPick: 'Наступний підбір: Пн, 26 жовт' },
  toast: { title: 'Готово! Ти прийняла 2 метчі', note: 'Штурхнемо, щойно хтось відповість' },
};
