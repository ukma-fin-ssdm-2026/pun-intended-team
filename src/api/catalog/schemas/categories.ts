// Written with the help of Claude
import { z } from 'zod';
import { Id } from '../../common/schemas/common.js';

const CategoryFields = z.object({
  id: Id,
  name: z.string(),
});

export const categoryExample: Category = {
  id: '0b6f2d4a-8c1e-4a3b-9d5f-7e2a4c6b8d01',
  name: 'Cinema',
};

export const Category = CategoryFields.meta({
  id: 'Category',
  description: 'An event category from the directory administrators manage',
  example: categoryExample,
});

export const CategoryList = z
  .object({ items: z.array(Category) })
  .meta({ id: 'CategoryList', example: { items: [categoryExample] } });

const AdminCategoryFields = CategoryFields.extend({
  isActive: z.boolean().describe('Inactive categories are hidden from filters and cannot be picked'),
});

const adminCategoryExample: AdminCategory = { ...categoryExample, isActive: true };

export const AdminCategory = AdminCategoryFields.meta({
  id: 'AdminCategory',
  description: 'A category as administrators see it',
  example: adminCategoryExample,
});

export const AdminCategoryList = z
  .object({ items: z.array(AdminCategory) })
  .meta({ id: 'AdminCategoryList', example: { items: [adminCategoryExample] } });

export const CategoryIdParams = z.object({
  id: Id.describe('Category id'),
});

export const ActiveCategoryId = Id.describe('An active category from listCategories');

const CategoryName = z.string().trim().min(1).max(60).describe('Unique, case-insensitive');

const CategoryIsActive = z.boolean().describe('Whether users can pick the category');

const CreateCategoryFields = z.strictObject({
  name: CategoryName,
  isActive: CategoryIsActive.default(true),
});

export const CreateCategoryBody = CreateCategoryFields.meta({
  id: 'CreateCategoryBody',
  example: { name: 'Workshops' } satisfies CreateCategoryBody,
});

const UpdateCategoryFields = z.strictObject({
  name: CategoryName.optional(),
  isActive: CategoryIsActive.optional(),
});

export const UpdateCategoryBody = UpdateCategoryFields.meta({
  id: 'UpdateCategoryBody',
  description: 'Only the fields to change',
  example: { isActive: false } satisfies UpdateCategoryBody,
});

export type Category = z.infer<typeof CategoryFields>;
export type CategoryList = z.infer<typeof CategoryList>;
export type AdminCategory = z.infer<typeof AdminCategoryFields>;
export type AdminCategoryList = z.infer<typeof AdminCategoryList>;
export type CreateCategoryBody = z.input<typeof CreateCategoryFields>;
export type UpdateCategoryBody = z.input<typeof UpdateCategoryFields>;
