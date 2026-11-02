// Written with the help of Claude
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  // The request is running: the buttons wait.
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
};

// "Видалити" removes the user's post; "Залишити" and the backdrop close the dialog.
export function DeletePostDialog({ visible, busy, onClose, onDelete }: Props) {
  return (
    <Overlay visible={visible} onClose={busy ? () => {} : onClose} placement="center">
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
            Видалити допис?
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Його більше не буде видно в стрічці. Цю дію не можна скасувати.
          </Text>
        </View>
        <Button label="Видалити" variant="dark" loading={busy} onPress={onDelete} />
        <Button label="Залишити" variant="light" disabled={busy} onPress={onClose} />
      </View>
    </Overlay>
  );
}
