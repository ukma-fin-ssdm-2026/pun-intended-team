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

export const CategoryList = z.object({ items: z.array(Category) }).meta({ id: 'CategoryList' });

const AdminCategoryFields = CategoryFields.extend({
  isActive: z.boolean().describe('Inactive categories are hidden from filters and cannot be picked'),
});

export const AdminCategory = AdminCategoryFields.meta({
  id: 'AdminCategory',
  description: 'A category as administrators see it',
  example: { ...categoryExample, isActive: true },
});

export const AdminCategoryList = z.object({ items: z.array(AdminCategory) }).meta({ id: 'AdminCategoryList' });

export const CategoryIdParams = z.object({
  id: Id.describe('Category id'),
});

const CategoryName = z.string().trim().min(1).max(60);

export const CreateCategoryBody = z
  .object({
    name: CategoryName,
    isActive: z.boolean().default(true),
  })
  .meta({ id: 'CreateCategoryBody' });

export const UpdateCategoryBody = z
  .object({
    name: CategoryName.optional(),
    isActive: z.boolean().optional(),
  })
  .meta({ id: 'UpdateCategoryBody', description: 'Only the fields to change' });

export type Category = z.infer<typeof CategoryFields>;
export type CategoryList = z.infer<typeof CategoryList>;
export type AdminCategory = z.infer<typeof AdminCategoryFields>;
export type AdminCategoryList = z.infer<typeof AdminCategoryList>;
