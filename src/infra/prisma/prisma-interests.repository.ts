// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { InterestsRepository } from '../../core/profiles/repositories/interests.repository.ts';
import type { Interest } from '../../core/profiles/types/profile.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

@Injectable()
export class PrismaInterestsRepository implements InterestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Groups in their set order, and the interests of a group by name in Ukrainian order. Names are sorted here: the
  // database's order depends on how it was created, and under the C collation "Є", "І" and "Ї" come before "А".
  async findAll(tx?: Transaction): Promise<Interest[]> {
    const rows = await clientOf(this.prisma, tx).interest.findMany({
      select: { id: true, name: true, groupName: true, groupPosition: true },
    });
    return rows
      .sort((a, b) => a.groupPosition - b.groupPosition || ukrainian.compare(a.name, b.name))
      .map(({ id, name, groupName }) => ({ id, name, group: groupName }));
  }
}

const ukrainian = new Intl.Collator('uk');
