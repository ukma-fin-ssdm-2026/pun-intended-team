// Written with the help of Claude

/**
 * The start of a text longer than `limit` characters, cut at the last whole word within them and without the
 * punctuation before the cut, for a preview that ends with "… Читати далі". A text that fits has no preview.
 */
export function textPreview(text: string, limit: number): string | undefined {
  if (text.length <= limit) return undefined;
  const cut = text.slice(0, limit);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.:;—-]+$/, '');
}
