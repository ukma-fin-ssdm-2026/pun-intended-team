// Written with the help of Claude
// AI Usage: "decline the match" confirmation; not in Figma, built like the other confirmation dialogs; reviewed by
// Viktoriia Baran.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  // The answer is being sent: the buttons wait.
  busy: boolean;
  onClose: () => void;
  onDecline: () => void;
};

export function DeclineMatchDialog({ visible, busy, onClose, onDecline }: Props) {
  return (
    <Overlay visible={visible} onClose={busy ? () => {} : onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="decline-close" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Відхилити метч?
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Пошукаємо тобі когось іншого на цю подію.
          </Text>
        </View>
        <Button label="Відхилити" variant="dark" loading={busy} onPress={onDecline} />
        <Button label="Ще подумаю" variant="light" disabled={busy} onPress={onClose} />
      </View>
    </Overlay>
  );
}
