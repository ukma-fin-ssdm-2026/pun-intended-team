// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { MatchesRepository } from '../../core/matching/repositories/matches.repository.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaMatchesRepository implements MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(): Promise<number> {
    return this.prisma.match.count();
  }
}
