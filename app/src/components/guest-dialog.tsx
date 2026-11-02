// Written with the help of Claude
// AI Usage: "Увійди, щоб знайти компанію" dialog from the Figma "02.2 Сторінка події · гість" screen; reviewed by Daryna
// Halytska.
import { Text, View } from 'react-native';

import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { Snackbar } from '@/components/ui/snackbar';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  visible: boolean;
  // "Не зараз", the backdrop and the Android back button.
  onClose: () => void;
  // Before the app leaves for the catalog, В5 or С3; the caller hides the dialog its own way.
  onLeave: () => void;
};

// Signs in or up with Google right here; a new account goes on to В5 for the date of birth.
export function GuestDialog({ visible, onClose, onLeave }: Props) {
  const google = useGoogleAuth(onLeave);
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
            Переглядати події можна й так, а метчі доступні після входу. Це займе хвилину.
          </Text>
        </View>
        <GoogleButton
          variant="dark"
          loading={google.loading}
          onIdToken={google.continueWithGoogle}
          onFailure={google.showSnackbar}
        />
        <Button label="Не зараз" variant="light" onPress={onClose} />
      </View>
      {/* Inside the modal, so it shows above the dialog. */}
      {google.snackbar && <Snackbar {...google.snackbar} />}
    </Overlay>
  );
}
