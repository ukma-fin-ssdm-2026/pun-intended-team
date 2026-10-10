// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from '../../core/catalog/repositories/categories.repository.ts';
import type { Category, CategoryChanges, NewCategory } from '../../core/catalog/types/category.ts';
import { DomainError } from '../../core/common/domain-error.ts';
import { categories, events, listings } from './data.ts';

@Injectable()
export class StubCategoriesRepository implements CategoriesRepository {
  async findById(id: string): Promise<Category | undefined> {
    const category = categories.find((category) => category.id === id);
    return category && { ...category };
  }

  async findAll(): Promise<Category[]> {
    return categories.map((category) => ({ ...category }));
  }

  async create(input: NewCategory): Promise<Category> {
    checkNameIsFree(input.name);
    const category: Category = { id: randomUUID(), ...input };
    categories.push(category);
    return { ...category };
  }

  async update(id: string, changes: CategoryChanges): Promise<Category> {
    const category = categories.find((category) => category.id === id);
    if (!category) {
      throw new Error(`No category ${id} to update`);
    }
    if (changes.name !== undefined) {
      checkNameIsFree(changes.name, id);
    }
    Object.assign(category, changes);
    return { ...category };
  }

  // Stands in for ON DELETE RESTRICT on events.category_id and listings.category_id.
  async delete(id: string): Promise<void> {
    if (events.some((event) => event.categoryId === id) || listings.some((listing) => listing.categoryId === id)) {
      throw new DomainError('CONFLICT', 'The category is in use; deactivate it instead');
    }
    const index = categories.findIndex((category) => category.id === id);
    if (index !== -1) {
      categories.splice(index, 1);
    }
  }
}

// Stands in for the unique index on lower(name).
function checkNameIsFree(name: string, exceptId?: string): void {
  const taken = categories.some(
    (category) => category.id !== exceptId && category.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw new DomainError('CONFLICT', 'A category with this name already exists');
  }
}
