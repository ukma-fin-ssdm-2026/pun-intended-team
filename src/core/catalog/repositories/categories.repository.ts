// Written with the help of Claude
import type { Category, CategoryChanges, NewCategory } from '../types/category.ts';

export abstract class CategoriesRepository {
  abstract findById(id: string): Promise<Category | undefined>;

  abstract findAll(): Promise<Category[]>;

  abstract create(category: NewCategory): Promise<Category>;

  abstract update(id: string, changes: CategoryChanges): Promise<Category>;

  abstract delete(id: string): Promise<void>;
}
