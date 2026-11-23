// Written with the help of Claude
import type { PoolMember } from '../../../src/core/matching/types/matching.ts';

/** A user who accepts anyone of any age: the default, so a test sets only the preference it is about. */
export const ACCEPTS_ANYONE = {
  gender: 'female',
  age: 25,
  preferredGender: 'any',
  ageMin: 18,
  ageMax: null,
} as const satisfies Pick<PoolMember, 'gender' | 'age' | 'preferredGender' | 'ageMin' | 'ageMax'>;
