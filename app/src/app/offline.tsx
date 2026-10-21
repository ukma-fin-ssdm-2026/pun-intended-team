// Written with the help of Claude
// AI Usage: no connection screen from the Figma "С1 Немає з’єднання" frame; reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';

import { SystemState } from '@/components/system-state';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

export default function OfflineScreen() {
  const router = useRouter();

  return (
    <SystemState
      icon={<Icon name="state-danger" size={34} color={colors.text['on-dark']} />}
      title="Немає інтернету"
      description="Перевір Wi-Fi або мобільні дані. Збережені події можна переглядати й без мережі."
      // The prototype opens the catalog, and the link П6 Збережені події.
      action={{ label: 'Спробувати ще раз', onPress: () => router.dismissTo('/') }}
      link={{
        label: 'Переглянути збережені події',
        onPress: () => router.navigate({ pathname: '/profile', params: { saved: '1' } }),
      }}
    />
  );
}
