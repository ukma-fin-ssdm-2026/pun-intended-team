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

export type Category = z.infer<typeof CategoryFields>;
