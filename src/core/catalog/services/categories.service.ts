// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import type { Category } from '../types/category.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  /** A category users can pick. */
  async findActive(id: string): Promise<Category | undefined> {
    const category = await this.categoriesRepository.findById(id);
    return category?.isActive ? category : undefined;
  }
}
