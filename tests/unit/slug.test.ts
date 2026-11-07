// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { slugify, uniqueSlug } from '../../dist/core/common/slug.js';

// The national transliteration (Cabinet of Ministers resolution No. 55, 2010), as the category slugs use it.
describe('slugify', () => {
  const cases = [
    { text: 'Майстер-класи', slug: 'maister-klasy', title: 'transliterates Ukrainian and keeps the hyphen' },
    { text: 'Дні відкритих дверей', slug: 'dni-vidkrytykh-dverei', title: 'joins words with hyphens' },
    { text: 'Щедрий Ґанок', slug: 'shchedryi-ganok', title: 'writes щ as shch and ґ as g, in lower case' },
    { text: 'Їжа, Євро, Юнь, Яр, Йога', slug: 'yizha-yevro-yun-yar-yoha', title: 'writes ї є ю я й at a word start' },
    { text: 'Країна, моє, сюди, моя, край', slug: 'kraina-moie-siudy-moia-krai', title: 'and inside a word' },
    { text: "М'ята та м’ята", slug: 'miata-ta-miata', title: 'drops apostrophes inside a word' },
    { text: 'Згарище', slug: 'zgharyshche', title: 'writes зг as zgh' },
    { text: 'Стенд-ап 2026!', slug: 'stend-ap-2026', title: 'keeps digits and drops punctuation' },
    { text: '  Open   Days  ', slug: 'open-days', title: 'keeps Latin and trims spaces at the ends' },
    { text: 'Café Crème', slug: 'cafe-creme', title: 'drops the accents of Latin letters' },
    { text: '★ ★ ★', slug: 'category', title: 'gives category when no letter or digit is left' },
  ];

  for (const { text, slug, title } of cases) {
    test(title, () => {
      assert.equal(slugify(text), slug);
    });
  }
});

describe('uniqueSlug', () => {
  test('keeps a slug no category has', () => {
    assert.equal(uniqueSlug('kino', new Set(['concerts'])), 'kino');
  });

  test('adds -2 to a taken slug', () => {
    assert.equal(uniqueSlug('kino', new Set(['kino'])), 'kino-2');
  });

  test('takes the first free number', () => {
    assert.equal(uniqueSlug('kino', new Set(['kino', 'kino-2', 'kino-3'])), 'kino-4');
  });
});
