// Written with the help of Claude
import type { AdminAccount, AdminEvent, AdminOrganization, AdminVenue } from '@/api/admin';

type Tone = 'coral' | 'muted' | 'dark' | 'green';

export const roleLabels: Record<AdminAccount['role'], string> = {
  user: 'Користувач',
  admin: 'Адміністратор',
};

export const accountStatusBadges: Record<AdminAccount['status'], { label: string; tone: Tone }> = {
  active: { label: 'Активний', tone: 'green' },
  pending: { label: 'Очікує', tone: 'muted' },
  banned: { label: 'Заблокований', tone: 'dark' },
};

export const signInLabels: Record<AdminAccount['signInMethods'][number], string> = {
  google: 'Google',
  password: 'Пароль',
};

export const organizationStatusBadges: Record<AdminOrganization['verificationStatus'], { label: string; tone: Tone }> =
  {
    pending: { label: 'Очікує', tone: 'coral' },
    verified: { label: 'Підтверджено', tone: 'green' },
    rejected: { label: 'Відхилено', tone: 'muted' },
    revoked: { label: 'Відкликано', tone: 'muted' },
  };

export const eventStatusBadges: Record<AdminEvent['status'], { label: string; tone: Tone }> = {
  published: { label: 'Опубліковано', tone: 'green' },
  cancelled: { label: 'Скасовано', tone: 'muted' },
};

export const sourceLabels: Record<AdminVenue['source'], string> = {
  organization: 'Організація',
  import: 'Імпорт',
};
