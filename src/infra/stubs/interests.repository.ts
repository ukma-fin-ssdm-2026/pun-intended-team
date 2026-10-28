// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { InterestsRepository } from '../../core/profiles/repositories/interests.repository.ts';
import type { Interest } from '../../core/profiles/types/profile.ts';
import { interests } from './data.ts';

@Injectable()
export class StubInterestsRepository implements InterestsRepository {
  async findAll(): Promise<Interest[]> {
    return interests.map((interest) => ({ ...interest }));
  }
}
