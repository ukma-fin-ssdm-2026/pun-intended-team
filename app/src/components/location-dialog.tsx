// Written with the help of Claude
// AI Usage: location access dialog from the Figma "Д1.2 Фільтри · Доступ до геолокації" frame; reviewed by Daryna
// Halytska.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  // "Не зараз" and the backdrop return to Д1.
  onClose: () => void;
  // "Дозволити" returns to Д1 too; the system permission prompt has no design yet.
  onAllow: () => void;
};

export function LocationDialog({ visible, onClose, onAllow }: Props) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="pin" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Показати події поруч?
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Дозволь Nearby бачити, де ти, щоб показати події неподалік.
          </Text>
        </View>
        <Button label="Дозволити" variant="dark" onPress={onAllow} />
        <Button label="Не зараз" variant="light" onPress={onClose} />
      </View>
    </Overlay>
  );
}
