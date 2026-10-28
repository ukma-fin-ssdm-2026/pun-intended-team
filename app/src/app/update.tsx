// Written with the help of Claude
// AI Usage: update required screen from the Figma "С2 Потрібне оновлення" frame; reviewed by Daryna Halytska.
import { View } from 'react-native';

import { SystemState } from '@/components/system-state';
import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

export default function UpdateRequiredScreen() {
  return (
    <SystemState
      icon={
        // Figma turns the long arrow up.
        <View style={{ transform: [{ rotate: '-90deg' }] }}>
          <Icon name="state-arrow" size={34} color={colors.text['on-dark']} />
        </View>
      }
      title="Час оновитися"
      description="Ми додали нові можливості й виправили помилки. Онови Nearby, щоб продовжити."
      // "Оновити" has no prototype link; the store link comes with the release builds.
      action={{ label: 'Оновити', onPress: () => {} }}
    />
  );
}
