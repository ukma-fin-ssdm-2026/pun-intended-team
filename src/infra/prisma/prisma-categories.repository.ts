// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from '../../core/catalog/repositories/categories.repository.ts';
import type { Category, CategoryChanges, NewCategory } from '../../core/catalog/types/category.ts';
import { DomainError } from '../../core/common/domain-error.ts';
import { events, listings } from '../stubs/data.ts';
import { Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

const NAME_TAKEN = 'A category with this name already exists';

@Injectable()
export class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | undefined> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    return category ? toCategory(category) : undefined;
  }

  async findAll(): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return categories.map(toCategory);
  }

  async create(input: NewCategory): Promise<Category> {
    await this.checkNameIsFree(input.name);
    return toCategory(await this.prisma.category.create({ data: input }).catch(rethrowNameTaken));
  }

  async update(id: string, changes: CategoryChanges): Promise<Category> {
    if (changes.name !== undefined) {
      await this.checkNameIsFree(changes.name, id);
    }
    return toCategory(await this.prisma.category.update({ where: { id }, data: changes }).catch(rethrowNameTaken));
  }

  // Events and listings are still stubs, so the check looks at them; it stands in for ON DELETE RESTRICT.
  async delete(id: string): Promise<void> {
    if (events.some((event) => event.categoryId === id) || listings.some((listing) => listing.categoryId === id)) {
      throw new DomainError('CONFLICT', 'The category is in use; deactivate it instead');
    }
    await this.prisma.category.deleteMany({ where: { id } });
  }

  // The unique index on name is case-sensitive; this makes "cinema" and "Cinema" collide as well.
  private async checkNameIsFree(name: string, exceptId?: string): Promise<void> {
    const taken = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, NOT: { id: exceptId } },
    });
    if (taken) {
      throw new DomainError('CONFLICT', NAME_TAKEN);
    }
  }
}

function toCategory({ id, name, isActive }: Category): Category {
  return { id, name, isActive };
}

// Two requests with the same name can both pass the check above; the unique index stops the second.
function rethrowNameTaken(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new DomainError('CONFLICT', NAME_TAKEN);
  }
  throw error;
}
