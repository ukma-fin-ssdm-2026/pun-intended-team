// Written with the help of Claude
// AI Usage: cancel event sheet from the Figma "О3 Організація · Скасувати подію" frame; reviewed by Daryna Halytska.
import { Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors } from '@/styles/tokens';

const consequences: { icon: IconName; text: string }[] = [
  { icon: 'bell', text: 'Усі, хто шукає компанію, отримають сповіщення' },
  { icon: 'matches', text: 'Пошук компанії на цю подію буде зупинено' },
  { icon: 'home', text: 'Подія зникне з каталогу і мапи' },
];

// "01 Шторка" has a 34 px bottom padding; a larger bottom inset replaces it.
const SHEET_BOTTOM = 34;

type Props = {
  visible: boolean;
  // The event's short name, as in "Скасувати «Джаз-вечір»?".
  eventName: string;
  // "Так, скасувати подію", "Залишити" and the backdrop all return to О1 in the prototype.
  onClose: () => void;
};

export function CancelEventSheet({ visible, eventName, onClose }: Props) {
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

          <View className="items-center gap-2.5">
            <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
              <Icon name="danger" size={26} color={colors.text['on-dark']} />
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
              Скасувати «{eventName}»?
            </Text>
            <Text className="text-center font-inter text-caption text-text-secondary">
              Цю дію не можна скасувати. Ось що станеться:
            </Text>
          </View>

          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            {consequences.map((item, index) => (
              <View key={item.icon}>
                {index > 0 && <View className="h-px bg-border-default" />}
                <View className="flex-row items-center gap-3 py-3">
                  <View className="size-9 items-center justify-center rounded-[11px] bg-surface-card">
                    <Icon name={item.icon} size={18} />
                  </View>
                  <Text className="flex-1 font-inter text-body text-text-primary">{item.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <Button label="Так, скасувати подію" onPress={onClose} />
          <Button label="Залишити" variant="light" onPress={onClose} />
        </View>
      </Animated.View>
    </Overlay>
  );
}
