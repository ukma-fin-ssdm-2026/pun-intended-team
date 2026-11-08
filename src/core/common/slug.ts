// Written with the help of Claude

/** Ukrainian letters in the national transliteration (Cabinet of Ministers resolution No. 55, 2010). */
const LATIN = new Map<string, string>(
  Object.entries({
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'h',
    ґ: 'g',
    д: 'd',
    е: 'e',
    є: 'ie',
    ж: 'zh',
    з: 'z',
    и: 'y',
    і: 'i',
    ї: 'i',
    й: 'i',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ь: '',
    ю: 'iu',
    я: 'ia',
  }),
);

/** At the start of a word these letters are written differently. */
const LATIN_AT_WORD_START = new Map(Object.entries({ є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' }));

/** Apostrophes inside a word, as in «м'ята»; they are dropped, not turned into a hyphen. */
const APOSTROPHES = /['’ʼ`]/g;

const FALLBACK = 'category';

/**
 * A slug for `text`: Ukrainian transliterated to Latin, lower case, words joined with hyphens, e.g.
 * «Майстер-класи» → `maister-klasy`. Text with no letter or digit left gets `category`.
 */
export function slugify(text: string): string {
  const lower = text.normalize('NFC').toLowerCase().replace(APOSTROPHES, '');
  let latin = '';
  for (let i = 0; i < lower.length; i++) {
    const letter = lower.charAt(i);
    const atWordStart = i === 0 || !/\p{L}/u.test(lower.charAt(i - 1));
    // «зг» is written `zgh`, so it is not read as «ж».
    if (letter === 'г' && lower.charAt(i - 1) === 'з') {
      latin += 'gh';
    } else {
      latin += (atWordStart ? LATIN_AT_WORD_START.get(letter) : undefined) ?? LATIN.get(letter) ?? letter;
    }
  }
  const slug = latin
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || FALLBACK;
}

/** `base`, or `base-2`, `base-3`… if it is taken: the first one not in `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}
