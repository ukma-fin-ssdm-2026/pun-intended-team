// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { CategoriesService } from '../../../core/catalog/services/categories.service.ts';
import { Endpoint } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { CategoryList } from '../schemas/categories.ts';

@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.categories.list,
    operationId: 'listCategories',
    summary: 'List the categories users can pick',
    description:
      'List the active categories users can pick for events and listings; their ids go in categoryIdffffffffffff.',
    tags: ['Categories'],
    access: 'guest',
    responses: {
      200: { description: 'The active categories', schema: CategoryList },
    },
  })
  async listCategories(): Promise<CategoryList> {
    return { items: await this.categoriesService.listActive() };
  }
}
