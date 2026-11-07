// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { slugify, uniqueSlug } from '../../common/slug.ts';
import { CategoriesRepository } from '../repositories/categories.repository.ts';
import type { Category, CategoryChanges, CategoryInput } from '../types/category.ts';
import { normalizeCategoryName } from './category-name.ts';

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

  /**
   * Adds a category with its name normalized (`normalizeCategoryName`) and a slug made from it; a taken slug gets
   * a number: `kino-2`.
   */
  async create(input: CategoryInput): Promise<Category> {
    const name = normalizeCategoryName(input.name);
    const taken = new Set((await this.categoriesRepository.findAll()).map((category) => category.slug));
    return this.categoriesRepository.create({
      name,
      isActive: input.isActive,
      slug: uniqueSlug(slugify(name), taken),
    });
  }

  /** Renames or (de)activates a category, the name normalized as on create; its slug stays as it is. */
  async update(id: string, { name, isActive }: CategoryChanges): Promise<Category> {
    await this.getById(id);
    return this.categoriesRepository.update(id, {
      name: name === undefined ? undefined : normalizeCategoryName(name),
      isActive,
    });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.categoriesRepository.delete(id);
  }
}
