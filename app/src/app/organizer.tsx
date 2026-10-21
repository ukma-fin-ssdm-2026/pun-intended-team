// Written with the help of Claude
// AI Usage: organizer placeholder from the Figma "Сторінка організатора (заглушка)" frame; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar).
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;

export default function OrganizerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useStatusBarStyle('dark');

  return (
    <View className="flex-1 bg-surface-card">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-row items-center justify-between px-5 pb-4"
        style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-primary">
          Організатор
        </Text>
        <View className="size-10" />
      </View>
      <View className="px-5 py-6">
        <Text className="font-inter text-caption text-text-secondary">
          Сторінка організатора зʼявиться пізніше: опис, контакти й події організатора.
        </Text>
      </View>
    </View>
  );
}
