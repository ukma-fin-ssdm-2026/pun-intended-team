// Written with the help of Claude
// AI Usage: safety reminder sheet from the Figma "06 Безпекова памʼятка" frame; reviewed by Daryna Halytska.
import { Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { mockPerson } from '@/mocks/matching';
import { colors } from '@/styles/tokens';

const rules: { icon: IconName; title: string; note: string }[] = [
  { icon: 'pin', title: 'Зустрічайтеся в публічному місці', note: 'На самій події або поруч із нею' },
  { icon: 'matches', title: 'Розкажи комусь близькому', note: 'Куди йдеш і з ким зустрічаєшся' },
  { icon: 'danger', title: 'Щось не так? Не мовчи', note: 'Модератор побачить твою скаргу за хвилину' },
];

// "01 Шторка" has a 34 px bottom padding; a larger bottom inset replaces it.
const SHEET_BOTTOM = 34;

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function SafetySheet({ visible, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
      <Animated.View entering={SlideInDown.duration(250)} accessibilityViewIsModal>
        <View
          className="gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3"
          style={{ paddingBottom: Math.max(SHEET_BOTTOM, insets.bottom) }}
        >
          <View className="items-center">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>

          <View className="items-center gap-3">
            <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
              <Icon name="shield" size={26} color={colors.text['on-dark']} />
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
              Перед першою зустріччю
            </Text>
            <Text className="text-center font-inter text-caption text-text-secondary">
              {mockPerson.name} теж прийняла метч! Кілька простих правил, і можна планувати зустріч.
            </Text>
          </View>

          <View className="gap-4">
            {rules.map((rule) => (
              <View key={rule.title} className="flex-row items-center gap-3.5">
                <View className="size-10 items-center justify-center rounded-xl bg-surface-background">
                  <Icon name={rule.icon} size={20} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="font-inter-medium text-body text-text-primary">{rule.title}</Text>
                  <Text className="font-inter text-caption text-text-secondary">{rule.note}</Text>
                </View>
              </View>
            ))}
          </View>

          <Button label="Зрозуміло" variant="dark" onPress={onConfirm} />
          <Text className="text-center font-inter text-caption text-text-secondary">
            Памʼятка завжди є в «Профіль → Безпека»
          </Text>
        </View>
      </Animated.View>
    </Overlay>
  );
}
