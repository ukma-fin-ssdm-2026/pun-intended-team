// Written with the help of Claude

/** Apostrophes people type in Ukrainian words; all are stored as ʼ (U+02BC). */
const APOSTROPHES = /['ʼ’]/g;

/**
 * A category name as it is saved: runs of spaces as one, no spaces at the ends, every apostrophe as ʼ. Names
 * are unique in lower case on top of this (`categories_name_normalized_key`), so «Кавʼярні» and «кав'ярні » clash.
 */
export function normalizeCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().replace(APOSTROPHES, 'ʼ');
}
