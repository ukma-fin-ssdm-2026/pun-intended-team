// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { InterestsRepository } from '../../core/profiles/repositories/interests.repository.ts';
import type { Interest } from '../../core/profiles/types/profile.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaInterestsRepository implements InterestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Interest[]> {
    return this.prisma.interest.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }
}
