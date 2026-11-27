// Written with the help of Claude
// AI Usage: mock matching data from the Figma Stage 3 screens; reviewed by Daryna Halytska.
import type { MutualPerson } from '@/components/matching/mutual-match';
import { mockProfile } from '@/mocks/profile';

// The people of the matching mocks: Олена is the new proposal for the jazz evening (05, Т2), Максим the mutual match
// for the house concert (Т2, Т5 "Це взаємно!", 06, 07).
type MatchPerson = {
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

// 07 Взаємний метч: the user's own initial next to the match's.
export const mockMutual = { ownInitial: mockProfile.initial };

// A mock person as the mutual match screen shows them, with the Telegram and phone rows of 07.
export function mockMutualPerson(person: MatchPerson): MutualPerson {
  return {
    name: person.name,
    initial: person.initial,
    instrumental: person.instrumental,
    genitive: person.genitive,
    contacts: [
      { key: 'telegram', icon: { network: 'telegram' }, label: 'Telegram', value: person.telegram },
      { key: 'phone', icon: { name: 'phone' }, label: 'Телефон', value: person.phone },
    ],
  };
}
