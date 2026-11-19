// Written with the help of Claude
import type { ApiResult } from '@/api/public-client';
import type { SnackbarContent } from '@/components/ui/snackbar';

export const messages = {
  phone: 'Перевір номер: +380 і 9 цифр',
  credentials: 'Неправильний номер або пароль',
  code: 'Код неправильний або вже не діє',
  underage: 'Nearby лише для людей від 18 років',
};

// For the failures a screen does not explain itself.
export function failureMessage(result: Extract<ApiResult<unknown>, { ok: false }>): string {
  return result.status === 0
    ? 'Немає з’єднання. Перевір інтернет і спробуй ще раз.'
    : 'Щось пішло не так. Спробуй ще раз.';
}

// The same failures as a snackbar: a title and a one-line note.
export function failureSnackbar(result: Extract<ApiResult<unknown>, { ok: false }>): SnackbarContent {
  return result.status === 0
    ? { tone: 'error', title: 'Немає з’єднання', note: 'Перевір інтернет' }
    : { tone: 'error', title: 'Щось пішло не так', note: 'Спробуй ще раз за хвилину' };
}

// An upload of a photo or a cover the API refused, or that was refused before it was sent.
export function pictureFailureSnackbar(result: Extract<ApiResult<unknown>, { ok: false }>): SnackbarContent {
  switch (result.code) {
    case 'PAYLOAD_TOO_LARGE':
      return { tone: 'error', title: 'Фото завелике', note: 'Обери фото до 10 МБ' };
    case 'UNSUPPORTED_MEDIA_TYPE':
    case 'INVALID_IMAGE':
      return { tone: 'error', title: 'Не вдалося прочитати фото', note: 'Обери фото у форматі JPEG, PNG або WebP' };
    default:
      return failureSnackbar(result);
  }
}

export const googleSnackbars = {
  // Expo Go, or a build without the Google client ids.
  unavailable: { tone: 'error', title: 'Вхід через Google недоступний', note: 'Ця збірка не налаштована для Google' },
  'play-services': { tone: 'error', title: 'Не вдалося відкрити Google', note: 'Онови Google Play Services' },
  other: { tone: 'error', title: 'Не вдалося увійти через Google', note: 'Спробуй ще раз' },
  expired: { tone: 'error', title: 'Вхід через Google застарів', note: 'Продовж з Google ще раз' },
} satisfies Record<string, SnackbarContent>;
