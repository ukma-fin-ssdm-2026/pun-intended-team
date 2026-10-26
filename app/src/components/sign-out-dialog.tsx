// Written with the help of Claude
// AI Usage: the "Вийти з акаунта?" dialog of the Figma П5 and О4.1 frames; reviewed by Daryna Halytska.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  // П5 shows the user icon, О4.1 the building.
  icon: IconName;
  note: string;
  onClose: () => void;
  onSignOut: () => void;
};

// "Вийти" signs out, "Залишитися" and the backdrop close the dialog.
export function SignOutDialog({ visible, icon, note, onClose, onSignOut }: Props) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name={icon} size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Вийти з акаунта?
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">{note}</Text>
        </View>
        <Button label="Вийти" variant="dark" onPress={onSignOut} />
        <Button label="Залишитися" variant="light" onPress={onClose} />
      </View>
    </Overlay>
  );
}
