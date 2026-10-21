// Written with the help of Claude
// AI Usage: sign-in rate limit screen from the Figma "С3 Забагато спроб" frame; reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';

import { SystemState } from '@/components/system-state';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

export default function TooManyAttemptsScreen() {
  const router = useRouter();
  // Both the button and the link open В4 Вхід in the prototype.
  const toSignIn = () => router.replace('/sign-in');

  return (
    <SystemState
      icon={<Icon name="state-clock" size={34} color={colors.text['on-dark']} />}
      title="Забагато спроб"
      description="Ми тимчасово обмежили вхід, щоб захистити твій акаунт."
      note="Спробуй ще раз через 14:52"
      action={{ label: 'Зрозуміло', onPress: toSignIn }}
      link={{ label: 'Написати в підтримку', onPress: toSignIn }}
    />
  );
}
