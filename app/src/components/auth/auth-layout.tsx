// Written with the help of Claude
// AI Usage: shared layout of the Figma sign-in and sign-up screens (В4–В8); reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { colors } from '@/styles/tokens';

// "01 Шапка": padding 56 / 20 (9 px below the iPhone 14 status bar at the top); the form sheet covers its bottom 28 px.
// "02 Форма": padding 28 / 20 / 34 / 20, gap 16.
const HEADER_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const SHEET_OVERLAP = 28;
const FORM_BOTTOM = 34;

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  // A link line pinned to the bottom of the form, e.g. "Немає акаунта? Зареєструватися".
  footer?: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useStatusBarStyle('light');

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface-card" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View
          className="gap-5 overflow-hidden px-5 pb-14"
          style={{ paddingTop: Math.max(HEADER_TOP, insets.top + GAP_BELOW_STATUS_BAR), marginBottom: -SHEET_OVERLAP }}
        >
          <View className="absolute inset-0">
            <CoralGradient preset="auth" />
          </View>
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              onPress={() => router.back()}
              className="size-10 items-center justify-center rounded-[20px] bg-white/[0.14]"
            >
              <Icon name="arrow-left" size={20} color={colors.text['on-dark']} />
            </Pressable>
            <Text className="font-alice text-[24px] text-text-on-dark">Nearby</Text>
            <View className="size-10" />
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="font-inter-bold text-display text-text-on-dark">
              {title}
            </Text>
            <Text className="font-inter text-body text-text-on-dark-muted">{subtitle}</Text>
          </View>
        </View>

        <View
          className="flex-1 gap-4 rounded-t-[28px] bg-surface-card px-5 pt-7"
          style={{ paddingBottom: Math.max(FORM_BOTTOM, insets.bottom) }}
        >
          {children}
          {footer && (
            <>
              <View className="flex-1" />
              {footer}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// "Немає акаунта? Зареєструватися": a secondary question and a coral link, 4 px apart.
export function AuthFooter({ question, link, onPress }: { question: string; link: string; onPress: () => void }) {
  return (
    <View className="flex-row justify-center gap-1">
      <Text className="font-inter-medium text-label text-text-secondary">{question}</Text>
      <Pressable accessibilityRole="link" onPress={onPress}>
        <Text className="font-inter-medium text-label text-brand-coral">{link}</Text>
      </Pressable>
    </View>
  );
}
