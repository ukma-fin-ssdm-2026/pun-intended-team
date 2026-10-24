// Written with the help of Claude
import type { ApiResult } from '@/api/public-client';

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
