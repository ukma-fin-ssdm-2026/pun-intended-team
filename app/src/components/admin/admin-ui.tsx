// Written with the help of Claude
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { ReportCase } from '@/api/admin';
import type { ApiResult } from '@/api/public-client';
import { Button } from '@/components/ui/button';
import { Overlay } from '@/components/ui/overlay';
import { Spinner } from '@/components/ui/spinner';
import { colors, shadows } from '@/styles/tokens';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

export const resolutionLabels: Record<NonNullable<ReportCase['resolution']>, string> = {
  banned: 'Заблоковано',
  removed: 'Видалено',
  dismissed: 'Відхилено',
};

export function failureText(failure: Failure): string {
  if (failure.status === 0) return 'Немає зʼєднання з сервером.';
  if (failure.status === 404) return 'Не знайдено, або цей акаунт не адміністратор.';
  return `Щось пішло не так (код ${failure.status}).`;
}

export function PageHeader({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <View className="flex-row items-end justify-between gap-6">
      <View className="gap-1">
        <Text accessibilityRole="header" className="font-inter-bold text-display text-text-primary">
          {title}
        </Text>
        {note && <Text className="font-inter text-body text-text-secondary">{note}</Text>}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-[20px] bg-surface-card ${className}`} style={{ boxShadow: shadows.small }}>
      {children}
    </View>
  );
}

// What a page shows instead of its content while loading or after a failed request.
export function LoadState({ failure, onRetry }: { failure?: Failure; onRetry: () => void }) {
  if (!failure) {
    return (
      <View className="items-center py-16">
        <Spinner size="lg" color={colors.brand.coral} />
      </View>
    );
  }
  return (
    <View className="items-center gap-4 py-16">
      <Text className="font-inter text-body text-text-secondary">{failureText(failure)}</Text>
      <Button label="Спробувати ще раз" variant="light" size="sm" onPress={onRetry} />
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'coral' | 'muted' | 'dark' }) {
  const look = {
    coral: 'bg-brand-coral-soft text-brand-coral-dark',
    muted: 'bg-surface-background text-text-secondary',
    dark: 'bg-brand-ink text-text-on-dark',
  }[tone];
  return (
    <View className="flex-row">
      <Text className={`rounded-[10px] px-2.5 py-1 font-inter-semibold text-tag ${look}`}>{label}</Text>
    </View>
  );
}

type ConfirmProps = {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ visible, title, text, confirmLabel, busy, error, onConfirm, onClose }: ConfirmProps) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="w-full max-w-[440px] gap-5 self-center rounded-[28px] bg-surface-card p-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="gap-2">
          <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
            {title}
          </Text>
          <Text className="font-inter text-body text-text-secondary">{text}</Text>
          {error && <Text className="font-inter text-caption text-brand-coral">{error}</Text>}
        </View>
        <View className="flex-row justify-end gap-3">
          <Button label="Скасувати" variant="light" onPress={onClose} />
          <Button label={confirmLabel} loading={busy} onPress={onConfirm} />
        </View>
      </View>
    </Overlay>
  );
}
