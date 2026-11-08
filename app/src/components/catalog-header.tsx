// Written with the help of Claude
// AI Usage: catalog header from the Figma "01 Каталог подій" and "01.2 Каталог · гість" screens; reviewed by Daryna
// Halytska.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

// "01 Шапка" has a 30 px top padding in Figma, less than a phone's status bar; there the header starts right below it.
const TOP_PADDING = 30;

type Props = {
  // Signed-in user's display name, once the profile has loaded; a guest has none.
  name?: string;
  hasUnread?: boolean;
  onNotificationsPress?: () => void;
  onAvatarPress: () => void;
};

export function CatalogHeader({ name, hasUnread = false, onNotificationsPress, onAvatarPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="gap-6 px-5" style={{ paddingTop: Math.max(TOP_PADDING, insets.top) }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-logo text-logo text-text-on-dark">Nearby</Text>
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
            // A guest has no notifications; a signed-in user's name may still be loading.
            accessibilityLabel={onNotificationsPress ? 'Профіль' : 'Увійти'}
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
