// Written with the help of Claude
// AI Usage: "complete your profile" dialog for use case E1; not in Figma, built like the 04.2 dialog; reviewed by
// Viktoriia Baran.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export function ProfileIncompleteDialog({ visible, onClose, onComplete }: Props) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="user" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Спершу заповни профіль
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Для метчингу потрібні формат спілкування, хоча б один інтерес і контакт, який побачить твій метч.
          </Text>
        </View>
        <Button label="Заповнити профіль" variant="dark" onPress={onComplete} />
        <Button label="Не зараз" variant="light" onPress={onClose} />
      </View>
    </Overlay>
  );
}
