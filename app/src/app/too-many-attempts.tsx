// Written with the help of Claude
// AI Usage: sign-in rate limit screen from the Figma "С3 Забагато спроб" frame; reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';

import { SystemState } from '@/components/system-state';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

export default function TooManyAttemptsScreen() {
  const router = useRouter();

  return (
    <SystemState
      icon={<Icon name="state-clock" size={34} color={colors.text['on-dark']} />}
      title="Забагато спроб"
      description="Ми тимчасово обмежили вхід, щоб захистити твій акаунт."
      note="Спробуй ще раз через 14:52"
      // The prototype opens В4 Вхід; support has no screen yet, so the link does nothing.
      action={{ label: 'Зрозуміло', onPress: () => router.replace('/sign-in') }}
      link={{ label: 'Написати в підтримку' }}
    />
  );
}
