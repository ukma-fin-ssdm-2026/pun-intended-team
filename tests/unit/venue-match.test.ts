// Written with the help of Claude
// How the import tells that two provider venues are one (ADR-006, decision 7), on the addresses and names of the
// live runs of 2026-11-07 and 2026-11-08.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { inKyiv } from '../../dist/core/common/kyiv-area.js';
import { nameWords, normalizedAddress, similarNames } from '../../dist/core/import/services/venue-match.js';

describe('normalizedAddress', () => {
  const same: [string, string][] = [
    ['вулиця Саксаганського, 6, Київ', 'вул. Саксаганського, 6, Київ'],
    ['вулиця Саксаганського, 6, Київ, Київ', 'вулиця Саксаганського, 6, Київ'],
    ['Бульварно-Кудрявська, 22, Київ', 'вул. Бульварно-Кудрявська, 22, Київ'],
    ['вулиця Князів Острозьких, 8, Київ', 'вул Князів Острозьких, 8, Київ'],
    ['вул.Князів Острозьких,3, Київ', 'вул. Князів Острозьких 3 (метро Арсенальна), Київ'],
    ['Нижньоюрківська, 31, Київ', 'вул. Нижньоюрківська 31, Київ'],
    ['вул. С. Петлюри, 4, Київ', 'вул. Петлюри, 4'],
    ['просп. Перемоги, 37, Київ', 'проспект Перемоги 37'],
  ];
  for (const [a, b] of same) {
    test(`takes "${a}" and "${b}" as one address`, () => {
      assert.equal(normalizedAddress(a), normalizedAddress(b));
      assert.notEqual(normalizedAddress(a), '');
    });
  }

  test('keeps the house number and its letter', () => {
    assert.equal(normalizedAddress('вул. Верхній Вал, 66а, Київ'), 'верхній вал 66а');
    assert.notEqual(normalizedAddress('вул. Верхній Вал, 66а'), normalizedAddress('вулиця Верхній Вал, 62'));
    assert.equal(normalizedAddress('вул. Січових Стрільців, 1-5, Київ'), 'січових стрільців 1-5');
  });

  test('is empty for an address without a house number', () => {
    assert.equal(normalizedAddress('Київ'), '');
    assert.equal(normalizedAddress('Центральний парк, Київ'), '');
  });
});

describe('similarNames', () => {
  const similar: [string, string][] = [
    ['Будинок Кіно', '«Будинок Кіно»'],
    ['Будинок Кіно', 'Будинок кіно'],
    ["Pepper's Club", 'Music Pub "Pepper\'s Club"'],
    ['CARIBBEAN club', 'Caribbean Club'],
    ['Театр «Особистості»', '"Особистості"'],
    ['Будинок архітектора', 'Архітектора'],
    ['Палац «Україна»', 'Палац Україна'],
    ['МЦКМ', 'МЦКМ (Жовтневий палац)'],
    ['Місце проведення: МЦКМ', 'МЦКМ (Жовтневий палац)'],
    ['Театр Браво', 'Київський драматичний театр Браво'],
    ['Палац Україна', 'Національний палац мистецтв «Україна»'],
  ];
  for (const [a, b] of similar) {
    test(`takes "${a}" and "${b}" as one venue`, () => {
      assert.equal(similarNames(a, b), true);
      assert.equal(similarNames(b, a), true);
    });
  }

  const different: [string, string][] = [
    ['Реверб', 'Otel’'],
    ['Закапелок', 'Продюсерський центр Ізмайлової'],
    ['Палац Україна', 'Палац спорту на Олімпійській'],
    ['', 'Хора'],
  ];
  for (const [a, b] of different) {
    test(`keeps "${a}" and "${b}" apart`, () => {
      assert.equal(similarNames(a, b), false);
    });
  }

  test('compares whole words, not parts of them', () => {
    assert.equal(similarNames('Арт', 'Будинок архітектора'), false);
  });

  test('reads the name without the Karabas label, quotes and the apostrophe kind', () => {
    assert.deepEqual(nameWords('Місце проведення: «Pepper’s Club»'), ["pepper's", 'club']);
  });
});

describe('inKyiv', () => {
  test('takes a point in the city and refuses one 300 km west of it', () => {
    assert.equal(inKyiv({ lat: 50.442236, lng: 30.545277 }), true);
    assert.equal(inKyiv({ lat: 50.328466, lng: 26.519548 }), false);
  });
});
