// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { InterestsRepository } from '../../core/profiles/repositories/interests.repository.ts';
import type { Interest } from '../../core/profiles/types/profile.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaInterestsRepository implements InterestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // By group, then by name, in Ukrainian order. The database's order depends on how it was created: under the C
  // collation "Є", "І" and "Ї" come before "А".
  async findAll(): Promise<Interest[]> {
    const rows = await this.prisma.interest.findMany({ select: { id: true, name: true, groupName: true } });
    return rows
      .map(({ id, name, groupName }) => ({ id, name, group: groupName }))
      .sort((a, b) => ukrainian.compare(a.group, b.group) || ukrainian.compare(a.name, b.name));
  }
}

const ukrainian = new Intl.Collator('uk');
