// Written with the help of Claude
// AI Usage: catalog header from the Figma "01 Каталог подій" and "01.2 Каталог · гість" screens; reviewed by Daryna
// Halytska.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

// "01 Шапка" has a 60 px top padding in the iPhone 14 frame, 13 px below its 47 px status bar. A taller status bar
// keeps that gap; on screens without one (the web) the padding stays 60 px, as in Figma.
const TOP_PADDING = 60;
const GAP_BELOW_STATUS_BAR = 13;

type Props = {
  // Signed-in user's name in the vocative case; a guest has none and sees no greeting or notifications.
  name?: string;
  hasUnread?: boolean;
  onNotificationsPress?: () => void;
  onAvatarPress: () => void;
};

export function CatalogHeader({ name, hasUnread = false, onNotificationsPress, onAvatarPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="gap-6 px-5" style={{ paddingTop: Math.max(TOP_PADDING, insets.top + GAP_BELOW_STATUS_BAR) }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-alice text-logo text-text-on-dark">Nearby</Text>
        <View className="flex-row items-center gap-3">
          {onNotificationsPress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hasUnread ? 'Сповіщення, є нові' : 'Сповіщення'}
              onPress={onNotificationsPress}
              className="size-11 items-center justify-center active:opacity-70"
            >
              <Icon name="bell" color={colors.text['on-dark']} />
              {hasUnread && <View className="absolute left-[26px] top-2.5 size-2 rounded-full bg-brand-coral" />}
            </Pressable>
          )}
          {/* No photo yet: Figma shows an empty surface/background circle. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={name ? 'Профіль' : 'Увійти'}
            onPress={onAvatarPress}
            className="size-12 rounded-full bg-surface-background active:opacity-80"
          />
        </View>
      </View>
      <View className="gap-1.5">
        {name && <Text className="font-inter text-caption text-text-on-dark-muted">Привіт, {name}</Text>}
        <Text className="font-inter-bold text-h1 text-text-on-dark">Обери подію, а ми знайдемо тобі компанію</Text>
      </View>
    </View>
  );
}
