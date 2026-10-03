// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from '../../core/catalog/repositories/categories.repository.js';
import type { Category } from '../../core/catalog/types/category.js';
import { categories } from './data.js';

@Injectable()
export class StubCategoriesRepository implements CategoriesRepository {
  async findById(id: string): Promise<Category | undefined> {
    const category = categories.find((category) => category.id === id);
    return category && { ...category };
  }

  async findAll(): Promise<Category[]> {
    return categories.map((category) => ({ ...category }));
  }
}
