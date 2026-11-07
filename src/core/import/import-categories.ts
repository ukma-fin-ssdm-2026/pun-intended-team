// Written with the help of Claude

/**
 * Ids of our categories, fixed by the seed_categories and event_images_and_categories migrations. Providers map
 * their genres to these ids, not to names, so an admin can rename a category without breaking the import.
 */
export const IMPORT_CATEGORY_IDS = {
  concerts: '2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03',
  exhibitions: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02',
  talks: '4863ac9d-4041-4f99-a07f-58a9da8005b3',
  workshops: 'b9f65262-80ab-49e6-ab63-8d05e27b5b7f',
  cinema: '74c445ac-7dcb-4ad5-850a-42eaf1862461',
  theatre: 'd288eb78-0e52-46cc-8df1-cc3702a24af4',
  standUp: '528ca201-66b1-4c62-bb01-5d370d198da1',
  sports: '19e33784-f77f-4163-bc52-42f94346058a',
  festivals: '2fad8151-a096-4da3-b77a-864f43eac606',
  parties: '5ede12cb-a086-48cd-b19d-c813f7e1bccf',
  volunteering: '7b15da0d-aa25-4132-8030-eb1acf8affb2',
  openDays: 'e7ca29c1-6d39-4f60-a74e-f492b203a27f',
} as const;
