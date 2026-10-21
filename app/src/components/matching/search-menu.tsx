// Written with the help of Claude
// AI Usage: company search menu and leave-pool dialog from the Figma "04.1" and "04.2" frames; reviewed by Daryna Halytska.
import { Pressable, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

// "01 Шторка" has a 34 px bottom padding; a larger bottom inset replaces it.
const SHEET_BOTTOM = 34;

function MenuItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  // "Як працює метчинг" has no prototype link and does nothing.
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center gap-3 py-3">
      <View className="size-9 items-center justify-center rounded-[11px] bg-surface-background">
        <Icon name={icon} size={18} color={danger ? colors.brand.coral : colors.text.primary} />
      </View>
      <Text className={`flex-1 font-inter-medium text-body ${danger ? 'text-brand-coral' : 'text-text-primary'}`}>
        {label}
      </Text>
      <Icon name="arrow-right" size={18} color={colors.text.secondary} />
    </Pressable>
  );
}

type MenuProps = {
  visible: boolean;
  onClose: () => void;
  // "Змінити побажання" opens 03 Запит на компанію.
  onChangeRequest: () => void;
  // "Вийти з пулу" opens 04.2.
  onLeave: () => void;
};

export function SearchMenuSheet({ visible, onClose, onChangeRequest, onLeave }: MenuProps) {
  const insets = useSafeAreaInsets();

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      <Animated.View entering={SlideInDown.duration(250)} accessibilityViewIsModal>
        <View
          className="gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3"
          style={{ paddingBottom: Math.max(SHEET_BOTTOM, insets.bottom) }}
        >
          <View className="items-center">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>
          <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
            Пошук компанії
          </Text>
          <View className="rounded-[20px] bg-surface-card px-4 py-1">
            <MenuItem icon="filter" label="Змінити побажання" onPress={onChangeRequest} />
            <View className="h-px bg-border-default" />
            <MenuItem icon="matches" label="Як працює метчинг" />
            <View className="h-px bg-border-default" />
            <MenuItem icon="close" label="Вийти з пулу" danger onPress={onLeave} />
          </View>
          <Button label="Закрити" onPress={onClose} />
        </View>
      </Animated.View>
    </Overlay>
  );
}

type DialogProps = {
  visible: boolean;
  // "Залишитися" and the backdrop go back to 04.1.
  onClose: () => void;
  // "Вийти з пулу" opens the event page (02).
  onLeave: () => void;
};

export function LeavePoolDialog({ visible, onClose, onLeave }: DialogProps) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="danger" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Вийти з пулу?
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Повернутися можна будь-коли зі сторінки події.
          </Text>
        </View>
        <Button label="Вийти з пулу" variant="dark" onPress={onLeave} />
        <Button label="Залишитися" variant="light" onPress={onClose} />
      </View>
    </Overlay>
  );
}
