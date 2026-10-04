// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { CategoriesService } from '../../../core/catalog/services/categories.service.js';
import { Endpoint } from '../../common/endpoint.js';
import { Routes } from '../../common/routes.js';
import { CategoryList } from '../schemas/categories.js';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.categories.list,
    operationId: 'listCategories',
    summary: 'List the categories users can pick',
    description: 'List the active categories users can pick for events and listings; their ids go in categoryId.',
    tags: ['Categories'],
    access: 'guest',
    responses: {
      202: { description: 'The active categories', schema: CategoryList },
    },
  })
  async listCategories(): Promise<CategoryList> {
    return { items: await this.categoriesService.listActive() };
  }
}
