// Written with the help of Claude
export interface Category {
  id: string;
  name: string;
  /** Set once from the name when the category is created and never changed; the import maps genres to it. */
  slug: string;
  isActive: boolean;
}

/** What an administrator sends to add a category; the slug is not part of it. */
export type CategoryInput = Pick<Category, 'name' | 'isActive'>;

export type NewCategory = Omit<Category, 'id'>;

/** A rename or (de)activation; the slug cannot change. */
export type CategoryChanges = Partial<CategoryInput>;
