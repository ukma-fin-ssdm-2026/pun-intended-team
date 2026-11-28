// Written with the help of Claude
// AI Usage: "read the safety notice first" dialog; not in Figma, built like the other matching dialogs; reviewed by
// Viktoriia Baran.
// No desktop frame in Figma; layout derived from 569:11221 (DП5 Вийти з акаунта): a centered dialog.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  onRead: () => void;
  onClose: () => void;
};

export function SafetyRequiredDialog({ visible, onRead, onClose }: Props) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="shield" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Спершу прочитай памʼятку
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Контакти зʼявляться, щойно ти погодишся з правилами безпеки.
          </Text>
        </View>
        <Button label="Прочитати памʼятку" variant="dark" onPress={onRead} />
      </View>
    </Overlay>
  );
}
