// Written with the help of Claude
// AI Usage: top bar of the Figma matching screens (04, 05, 07); reviewed by Daryna Halytska.
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top of the iPhone 14 frame, 9 px below its 47 px status bar. A taller status bar
// keeps that gap; without one (the web) the bar stays at 56 px.
const TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;

type Props = {
  title?: string;
  subtitle?: string;
  onBack: () => void;
  // "Ще": the menu on 04, a report on 05 and 07; without a handler the button is shown but does nothing.
  onMore?: () => void;
};

const buttonClass = 'size-10 items-center justify-center rounded-[20px] bg-white/[0.14]';

export function MatchingNav({ title, subtitle, onBack, onMore }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center gap-3 px-5"
      style={{ paddingTop: Math.max(TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={onBack} className={buttonClass}>
        <Icon name="arrow-left" size={20} color={colors.text['on-dark']} />
      </Pressable>
      <View className="flex-1 items-center">
        {title && (
          <Text numberOfLines={1} className="font-inter-semibold text-title text-text-on-dark">
            {title}
          </Text>
        )}
        {subtitle && (
          <Text numberOfLines={1} className="font-inter text-caption text-text-on-dark-muted">
            {subtitle}
          </Text>
        )}
      </View>
      {onMore ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Ще" onPress={onMore} className={buttonClass}>
          <Icon name="menu-dots" size={20} color={colors.text['on-dark']} />
        </Pressable>
      ) : (
        <View className={buttonClass}>
          <Icon name="menu-dots" size={20} color={colors.text['on-dark']} />
        </View>
      )}
    </View>
  );
}
