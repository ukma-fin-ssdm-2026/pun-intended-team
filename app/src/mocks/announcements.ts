// Written with the help of Claude
// AI Usage: mock posts from the Figma "Т3 Оголошення" frame; reviewed by Daryna Halytska.
import type { Post } from '@/components/announcements/post';

// Dates are shifted like the mock events (Figma's Нд, 19 жовт is Нд, 25 жовт here).
export const mockPosts: Post[] = [
  {
    id: 'post-1',
    initial: 'І',
    nameAge: 'Ірина, 26',
    author: { name: 'Ірина', accusative: 'Ірину', instrumental: 'Іриною', username: 'iryna' },
    meta: '· Лук’янівка · 2 год',
    text: 'Шукаємо ще 2–3 людей на настолки в антикафе в неділю о 17:00. Граємо в «Кодові імена» і «Діксіт», новачкам пояснимо правила.',
    chips: [
      { icon: 'calendar', label: 'Нд, 25 жовт · 17:00' },
      { icon: 'pin', label: 'Антикафе «Ліхтар»' },
    ],
    going: false,
  },
  {
    id: 'post-2',
    initial: 'А',
    nameAge: 'Артем, 20',
    author: { name: 'Артем', accusative: 'Артема', instrumental: 'Артемом', username: 'artem' },
    meta: '· Печерськ · 5 год',
    text: 'Хтось іде на джаз в Арсенал у суботу? Квиток уже є, хочу компанію на вечір і, може, прогулянку після.',
    eventId: '7a2d4b5c-0002-4b00-8000-000000000001',
    going: true,
  },
  {
    id: 'post-3',
    initial: 'М',
    nameAge: 'Максим, 22',
    author: { name: 'Максим', accusative: 'Максима', instrumental: 'Максимом', username: 'maksym' },
    meta: '· Поділ · вчора',
    text: 'Велопрогулянка Трухановим островом у суботу зранку. Спокійний темп, близько 20 км, потім кава на набережній.',
    // Figma uses this photo for the post.
    photo: require('@/assets/images/events/kvartyrnyk.png'),
    going: false,
  },
];

// Д4 Хоче піти з тобою: Олена answers the user's post about board games (Т5.1).
export const mockJoinRequest = {
  initial: 'О',
  nameAge: 'Олена, 23',
  interests: 'Настільні ігри · Кіно · Джаз',
  post: 'Шукаємо ще 2–3 людей на настолки в антикафе в неділю о 17:00.',
  details: 'Нд, 19 жовт · 17:00 · Антикафе «Ліхтар»',
  note: 'Прийми, і ви одразу зможете домовитися про зустріч.',
};
