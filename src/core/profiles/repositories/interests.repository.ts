// Written with the help of Claude
import type { Interest } from '../types/profile.ts';

/** The fixed list of interests users pick from, seeded at launch. */
export abstract class InterestsRepository {
  abstract findAll(): Promise<Interest[]>;
}
