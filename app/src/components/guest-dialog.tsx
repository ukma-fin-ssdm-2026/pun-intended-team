// Written with the help of Claude
// AI Usage: "Увійди, щоб знайти компанію" dialog from the Figma "02.2 Сторінка події · гість" screen; reviewed by Daryna
// Halytska.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors, shadows } from '@/styles/tokens';

export type AuthRoute = '/sign-up' | '/sign-in';

type Props = {
  visible: boolean;
  onClose: () => void;
  // The caller hides the dialog its own way before opening В5 Реєстрація or В4 Вхід.
  onAuth: (route: AuthRoute) => void;
};

export function GuestDialog({ visible, onClose, onAuth }: Props) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5 px-5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="user" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Увійди, щоб знайти компанію
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Переглядати події можна й так, а метчі доступні після реєстрації. Це займе хвилину.
          </Text>
        </View>
        <Button label="Зареєструватися" variant="dark" onPress={() => onAuth('/sign-up')} />
        <Button label="Увійти" variant="light" onPress={() => onAuth('/sign-in')} />
      </View>
    </Overlay>
  );
}
