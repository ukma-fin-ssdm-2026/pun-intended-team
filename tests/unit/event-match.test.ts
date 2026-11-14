// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { similarTitles, titleWords } from '../../dist/core/import/services/event-match.js';

// ADR-006, decision 8: titles as ArtWizard and Karabas write the same event.
describe('similarTitles', () => {
  const same: [string, string][] = [
    ['Bridgerton: Розкішний вечір музики при свічках', 'Bridgerton. Розкішний вечір музики при свічках'],
    ['Концерт «Шлягер року»', 'Концерт "Шлягер року"'],
    ['Музика кохання. Бенефіс Лариси Кадочнікової', 'Музика кохання: бенефіс Лариси Кадочнікової'],
    ['SAX Day! День саксофона', 'SAX Day! День саксофона (Музичний салон НФУ)'],
    ['Гурт Третій Зайвий', 'Третій Зайвий'],
    ["Концерт пам'яті ROCK ЛЕГЕНДИ", 'Концерт пам`яті ROCK ЛЕГЕНДИ Сергія Олександровича Усачова - Mari Peugeot'],
  ];
  for (const [artWizard, karabas] of same) {
    test(`takes "${artWizard}" and "${karabas}" for one event`, () => {
      assert.equal(similarTitles(artWizard, karabas), true);
      assert.equal(similarTitles(karabas, artWizard), true);
    });
  }

  const different: [string, string][] = [
    ['Німецька органна музика', 'Французька органна музика'],
    ['Пашина 20. Битва Імен. Justin Timberlake / Robbie Williams', 'Пашина 20. Битва Імен. Bryan Adams / Sting'],
    ['Проста симфонія', 'Проста ніч'],
    ['', 'Проста симфонія'],
  ];
  for (const [a, b] of different) {
    test(`keeps "${a}" and "${b}" apart`, () => {
      assert.equal(similarTitles(a, b), false);
    });
  }
});

describe('titleWords', () => {
  test('lower case, without quotes, brackets or punctuation', () => {
    assert.deepEqual(titleWords('SAX Day! «День саксофона» (Музичний салон НФУ)'), [
      'sax',
      'day',
      'день',
      'саксофона',
      'музичний',
      'салон',
      'нфу',
    ]);
  });
});
