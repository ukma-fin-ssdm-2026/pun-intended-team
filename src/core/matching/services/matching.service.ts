// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { MatchesRepository } from '../repositories/matches.repository.ts';

@Injectable()
export class MatchingService {
  constructor(private readonly matchesRepository: MatchesRepository) {}

  /** Every match proposed so far, whatever its state. */
  async stats(): Promise<{ matches: number }> {
    return { matches: await this.matchesRepository.count() };
  }
}
