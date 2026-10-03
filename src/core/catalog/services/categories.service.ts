// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.js';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import type { Category, CategoryChanges, NewCategory } from '../types/category.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  /** A category users can pick. */
  async findActive(id: string): Promise<Category | undefined> {
    const category = await this.categoriesRepository.findById(id);
    return category?.isActive ? category : undefined;
  }

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.findAll();
  }

  async listActive(): Promise<Category[]> {
    const categories = await this.categoriesRepository.findAll();
    return categories.filter((category) => category.isActive);
  }

  async getById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new DomainError('NOT_FOUND', 'Category not found');
    }
    return category;
  }

  async create(input: NewCategory): Promise<Category> {
    return this.categoriesRepository.create(input);
  }

  async update(id: string, changes: CategoryChanges): Promise<Category> {
    await this.getById(id);
    return this.categoriesRepository.update(id, changes);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.categoriesRepository.delete(id);
  }
}
