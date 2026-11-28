// Written with the help of Claude
// AI Usage: safety reminder sheet from the Figma "06 Безпекова памʼятка" frame; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { SheetHandle, useSheetEntering, useSheetPadding } from '@/components/ui/sheet';
import { colors } from '@/styles/tokens';

const rules: { icon: IconName; title: string; note: string }[] = [
  { icon: 'pin', title: 'Зустрічайтеся в публічному місці', note: 'На самій події або поруч із нею' },
  { icon: 'matches', title: 'Розкажи комусь близькому', note: 'Куди йдеш і з ким зустрічаєшся' },
  { icon: 'danger', title: 'Щось не так? Не мовчи', note: 'Модератор побачить твою скаргу за хвилину' },
];

type Props = {
  visible: boolean;
  // The mutual match the reminder is about; `accepted` is the verb in their gender, as the mocks have it. Without
  // one, it is the reminder opened from the profile.
  person?: { name: string; accepted?: string };
  // The acknowledgment is being sent: the button waits.
  busy?: boolean;
  onClose: () => void;
  // `dontShowAgain`: the box under the rules is ticked; it is offered only on a match.
  onConfirm: (dontShowAgain: boolean) => void;
};

export function SafetySheet({ visible, person, busy, onClose, onConfirm }: Props) {
  const entering = useSheetEntering();
  const padding = useSheetPadding();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
      <Animated.View entering={entering} accessibilityViewIsModal>
        <View className="gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3" style={padding}>
          <SheetHandle />

          <View className="items-center gap-3">
            <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
              <Icon name="shield" size={26} color={colors.text['on-dark']} />
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
              Перед першою зустріччю
            </Text>
            <Text className="text-center font-inter text-caption text-text-secondary">
              {person ? (
                <>
                  {person.accepted
                    ? `${person.name} теж ${person.accepted} метч!`
                    : `${person.name} теж хоче піти разом!`}{' '}
                  Кілька простих правил, і можна планувати зустріч.
                </>
              ) : (
                'Кілька простих правил для зустрічі з новими людьми.'
              )}
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

          {person && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dontShowAgain }}
              onPress={() => setDontShowAgain((value) => !value)}
              hitSlop={8}
              className="flex-row items-center gap-2.5"
            >
              <View
                className={`size-[22px] items-center justify-center rounded-[7px] ${
                  dontShowAgain ? 'bg-brand-ink' : 'border-[1.5px] border-border-default bg-surface-card'
                }`}
              >
                {dontShowAgain && <Icon name="checkbox-check" size={16} color={colors.text['on-dark']} />}
              </View>
              <Text className="flex-1 font-inter text-caption text-text-secondary">Більше не показувати</Text>
            </Pressable>
          )}
          <Button
            label="Зрозуміло"
            variant="dark"
            loading={busy}
            onPress={() => onConfirm(person ? dontShowAgain : false)}
          />
          {person && (
            <Text className="text-center font-inter text-caption text-text-secondary">
              Памʼятка завжди є в «Профіль → Безпека»
            </Text>
          )}
        </View>
      </Animated.View>
    </Overlay>
  );
}
