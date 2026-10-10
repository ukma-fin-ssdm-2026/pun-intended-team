// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { CategoriesService } from '../../../core/catalog/services/categories.service.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import {
  AdminCategory,
  AdminCategoryList,
  CategoryIdParams,
  CreateCategoryBody,
  UpdateCategoryBody,
} from '../schemas/categories.ts';

const GetCategoryRequest = { params: CategoryIdParams } satisfies RequestSchemas;
const CreateCategoryRequest = { body: CreateCategoryBody } satisfies RequestSchemas;
const UpdateCategoryRequest = { params: CategoryIdParams, body: UpdateCategoryBody } satisfies RequestSchemas;
const DeleteCategoryRequest = { params: CategoryIdParams } satisfies RequestSchemas;

const CATEGORY_NOT_FOUND = {
  description: 'No category with this id, or the caller is not an administrator',
  schema: ErrorResponse,
};

const NAME_TAKEN = { description: 'Another category already has this name', schema: ErrorResponse };

@Controller()
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.categories,
    operationId: 'adminListCategories',
    summary: 'List all categories',
    description:
      'List all categories, including inactive ones, to manage the directory. ' +
      'To pick a category for an event or listing, use listCategories.',
    tags: ['Categories'],
    access: 'admin',
    responses: {
      200: { description: 'All categories, active or not', schema: AdminCategoryList },
    },
  })
  async listCategories(): Promise<AdminCategoryList> {
    return { items: await this.categoriesService.findAll() };
  }

  @Endpoint({
    method: 'get',
    path: Routes.admin.categoryById,
    operationId: 'adminGetCategory',
    summary: 'Get a category',
    description: 'Get one category, including whether it is active.',
    tags: ['Categories'],
    access: 'admin',
    request: GetCategoryRequest,
    responses: {
      200: { description: 'The category', schema: AdminCategory },
      404: CATEGORY_NOT_FOUND,
    },
  })
  async getCategory(@Input() { params }: RouteInput<typeof GetCategoryRequest>): Promise<AdminCategory> {
    return this.categoriesService.getById(params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.admin.categories,
    operationId: 'adminCreateCategory',
    summary: 'Add a category',
    tags: ['Categories'],
    access: 'admin',
    request: CreateCategoryRequest,
    responses: {
      201: { description: 'The new category', schema: AdminCategory },
      409: NAME_TAKEN,
    },
    location: Routes.admin.categoryById,
  })
  async createCategory(@Input() { body }: RouteInput<typeof CreateCategoryRequest>): Promise<AdminCategory> {
    return this.categoriesService.create(body);
  }

  @Endpoint({
    method: 'patch',
    path: Routes.admin.categoryById,
    operationId: 'adminUpdateCategory',
    summary: 'Rename, deactivate or reactivate a category',
    tags: ['Categories'],
    access: 'admin',
    request: UpdateCategoryRequest,
    responses: {
      200: { description: 'The updated category', schema: AdminCategory },
      404: CATEGORY_NOT_FOUND,
      409: NAME_TAKEN,
    },
  })
  async updateCategory(@Input() { params, body }: RouteInput<typeof UpdateCategoryRequest>): Promise<AdminCategory> {
    return this.categoriesService.update(params.id, body);
  }

  @Endpoint({
    method: 'delete',
    path: Routes.admin.categoryById,
    operationId: 'adminDeleteCategory',
    summary: 'Delete an unused category',
    tags: ['Categories'],
    access: 'admin',
    request: DeleteCategoryRequest,
    responses: {
      204: { description: 'The category was deleted' },
      404: CATEGORY_NOT_FOUND,
      409: { description: 'An event or listing uses the category; deactivate it instead', schema: ErrorResponse },
    },
  })
  async deleteCategory(@Input() { params }: RouteInput<typeof DeleteCategoryRequest>): Promise<void> {
    await this.categoriesService.delete(params.id);
  }
}
