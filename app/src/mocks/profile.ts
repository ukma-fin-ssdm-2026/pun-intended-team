// Written with the help of Claude
// AI Usage: mock profile from the Figma "Т4 Профіль" and "П1 Редагувати профіль" frames; reviewed by Daryna Halytska.
import { mockUser } from '@/mocks/user';

export const mockProfile = {
  initial: 'С',
  firstName: mockUser.firstName,
  nameAge: `${mockUser.firstName}, 20`,
  occupation: 'Студентка КМА',
  about: 'Люблю камерні концерти й виставки. Після подій обожнюю довгі прогулянки й каву.',
  interests: ['Джаз', 'Сучасне мистецтво', 'Лекції'],
  // П1 offers these too; "+ ще" opens more later.
  moreInterests: ['Кіно', 'Театр', 'Стендап', 'Інді'],
  // П1.2 Інтереси: every interest, in Figma's order.
  allInterests: [
    'Джаз',
    'Кіно',
    'Настільні ігри',
    'Виставки',
    'Лекції',
    'Стендап',
    'Поезія',
    'Інді',
    'Театр',
    'Фотографія',
    'Кава',
    'Прогулянки',
    'Книги',
    'Танці',
    'Подорожі',
    'Спорт',
  ],
  // П1.1 Додати соцмережу: the nickname filled in for the selected network.
  socialNickname: '@solomiia.h',
  telegram: '@solomiia_h',
  phone: '+380 67 123 45 67',
  // As Т4 shows the number to the user.
  phoneMasked: '+380 67 ••• •• 67',
  // Figma uses this photo as the user's cover on Т4.
  cover: require('@/assets/images/events/kvartyrnyk.png'),
};
