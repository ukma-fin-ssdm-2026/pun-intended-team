// Written with the help of Claude
// "Для організацій" has no Figma frame: В3 "Безпечний простір" with the organization's text, opened from the web
// onboarding. Its Google button signs in an organization, or signs one up and opens its request (DО4) after В5.
import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleButton } from '@/components/auth/google-button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon, type IconName } from '@/components/ui/icon';
import { Snackbar } from '@/components/ui/snackbar';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { colors } from '@/styles/tokens';

// As В3's "02 Дії".
const ACTIONS_BOTTOM = 34;

const rules: { icon: IconName; text: string }[] = [
  { icon: 'calendar', text: 'Публікуй події свого закладу чи спільноти' },
  { icon: 'status-check', text: 'Адміністратор перевірить організацію, перш ніж її події зʼявляться в каталозі' },
  { icon: 'user', text: 'Це окремий акаунт: увійди Google-акаунтом організації, а не особистим' },
];

export default function ForOrganizationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const google = useGoogleAuth(undefined, true);
  useStatusBarStyle('light');

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute inset-0">
        <CoralGradient preset="screen" />
      </View>

      {/* A centered column on a computer, where organizations open it. */}
      <View className="absolute left-0 right-0 top-[150px] mx-auto w-full max-w-[480px] items-center gap-7 px-5">
        <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08]">
          <View
            className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
            style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
          >
            <Icon name="building" size={34} color={colors.text['on-dark']} />
          </View>
        </View>
        <Text accessibilityRole="header" className="text-center font-inter-bold text-display text-text-on-dark">
          Для організацій
        </Text>
        <View className="w-full gap-4">
          {rules.map((rule) => (
            <View key={rule.text} className="flex-row items-center gap-3">
              <View className="size-9 items-center justify-center rounded-[18px] bg-white/[0.12]">
                <Icon name={rule.icon} size={18} color={colors.text['on-dark']} />
              </View>
              <Text className="flex-1 font-inter text-body text-text-on-dark">{rule.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        className="absolute bottom-0 left-0 right-0 items-center gap-[18px] px-5"
        style={{ paddingBottom: Math.max(ACTIONS_BOTTOM, insets.bottom) }}
      >
        <View className="w-full">
          <GoogleButton
            variant="light"
            loading={google.loading}
            onIdToken={google.continueWithGoogle}
            onFailure={google.showSnackbar}
          />
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        >
          <Text className="font-inter-medium text-label text-text-on-dark-muted">Назад</Text>
        </Pressable>
      </View>
      {google.snackbar && <Snackbar {...google.snackbar} />}
    </View>
  );
}
