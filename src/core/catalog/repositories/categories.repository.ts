// Written with the help of Claude
import type { Category } from '../types/category.js';

export abstract class CategoriesRepository {
  abstract findById(id: string): Promise<Category | undefined>;

  abstract findAll(): Promise<Category[]>;
}
