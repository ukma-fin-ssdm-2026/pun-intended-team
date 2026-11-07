// Written with the help of Claude
import type { ApiResult } from '@/api/public-client';
import { failureMessage } from '@/auth/messages';

// What the API's answer to publishing, editing or cancelling an event means for the organization, in words.
export function eventFailure(failure: Extract<ApiResult<unknown>, { ok: false }>): string {
  switch (failure.code) {
    case 'ORGANIZATION_NOT_VERIFIED':
      return 'Події публікує лише підтверджена організація. Твій акаунт ще не підтверджено.';
    case 'EVENT_ENDS_BEFORE_START':
      return 'Подія має закінчуватися пізніше, ніж починається. Перевір час початку й кінця.';
    case 'EVENT_CANCELLED':
      return 'Скасовану подію не можна редагувати.';
    case 'REFERENCE_NOT_FOUND':
      return 'Категорію або місце не знайдено. Обери місце, що належить твоїй організації.';
    case 'NOT_FOUND':
      return 'Такої події вже немає, або вона не твоя.';
    case 'VALIDATION_ERROR':
      return 'Перевір поля: назва до 120 символів, опис до 5000.';
    case 'UNAUTHENTICATED':
      return 'Увійди ще раз, щоб продовжити.';
    default:
      return failureMessage(failure);
  }
}
