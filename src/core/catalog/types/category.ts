// Written with the help of Claude
export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export type NewCategory = Omit<Category, 'id'>;

export type CategoryChanges = Partial<NewCategory>;
