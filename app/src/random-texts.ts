// Written with the help of Claude
import { useSyncExternalStore } from 'react';

// Fun texts, one list per place in the app; a screen shows one of its place's list at random. Keep them
// gender-neutral: first-person verbs in the present tense ("доглядаю") have no gender in Ukrainian.
const texts = {
  // "Чим займаєшся?" on В7 and П1.
  occupation: [
    'Наприклад, доглядаю маяк на Місяці',
    'Наприклад, вчу котів квантової фізики',
    'Наприклад, складаю розклад для хмар',
    'Наприклад, навчаю равликів поспішати',
    'Наприклад, вигулюю динозаврів по неділях',
    'Наприклад, шукаю золото на кінці веселки',
    'Наприклад, рахую овець за всіх, хто не може заснути',
    'Наприклад, ремонтую машину часу',
    'Наприклад, шукаю загублені шкарпетки на вимогу',
    'Наприклад, перевіряю дощ на вологість',
  ],
} satisfies Record<string, readonly [string, ...string[]]>;

export type TextPlace = keyof typeof texts;

function randomText(place: TextPlace): string {
  const options = texts[place];
  return options[Math.floor(Math.random() * options.length)] ?? options[0];
}

const picked = new Map<TextPlace, string>();
const subscribe = () => () => undefined;

// One text per place for each launch of the app (or load of the web page). The web page rendered at build time and
// the browser's first render both show the first text, so they match; the random one replaces it right after.
export function useRandomText(place: TextPlace): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      let text = picked.get(place);
      if (text === undefined) {
        text = randomText(place);
        picked.set(place, text);
      }
      return text;
    },
    () => texts[place][0],
  );
}
