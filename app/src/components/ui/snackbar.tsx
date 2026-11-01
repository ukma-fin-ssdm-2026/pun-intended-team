// Written with the help of Claude
// AI Usage: snackbar ("10 Сповіщення (снекбар)") of the Figma Т2.2 and Т3.2 frames; reviewed by Daryna Halytska.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { colors, shadows } from '@/styles/tokens';

// 8 px below the status bar; one height on every screen, so the note is kept to one line.
const GAP_BELOW_STATUS_BAR = 8;
const HEIGHT = 64;
const SHOWN_MS = 4000;

export type SnackbarContent = {
  title: string;
  note: string;
  tone?: 'success' | 'error';
  action?: { label: string; onPress: () => void };
};

export function Snackbar({ title, note, tone = 'success', action }: SnackbarContent) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="alert"
      className="absolute left-5 right-5 flex-row items-center gap-3 overflow-hidden rounded-[18px] bg-surface-card px-3.5"
      style={{ top: insets.top + GAP_BELOW_STATUS_BAR, height: HEIGHT, boxShadow: shadows.medium }}
    >
      <View className="size-8 items-center justify-center rounded-2xl bg-brand-coral">
        <Icon name={tone === 'error' ? 'danger' : 'toast-check'} size={18} color={colors.text['on-dark']} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
          {title}
        </Text>
        <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
          {note}
        </Text>
      </View>
      {action && (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={12}>
          <Text className="font-inter-semibold text-label text-brand-coral">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// A snackbar that hides itself after a few seconds; showing another one restarts the timer.
export function useSnackbar() {
  const [snackbar, setSnackbar] = useState<SnackbarContent>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((content: SnackbarContent) => {
    clearTimeout(timer.current);
    setSnackbar(content);
    timer.current = setTimeout(() => setSnackbar(undefined), SHOWN_MS);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setSnackbar(undefined);
  }, []);

  return { snackbar, show, hide };
}
