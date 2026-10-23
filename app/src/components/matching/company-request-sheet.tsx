// Written with the help of Claude
// AI Usage: company request sheet from the Figma "03 Запит на компанію" screen; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { RadioOption } from '@/components/ui/radio-option';
import { colors } from '@/styles/tokens';

type CompanyType = 'evening' | 'friends' | 'date';

const companyTypes: { value: CompanyType; icon: IconName; title: string; note: string }[] = [
  { value: 'evening', icon: 'ticket', title: 'Компанія на вечір', note: 'Сходити разом і поспілкуватися' },
  { value: 'friends', icon: 'matches', title: 'Нові друзі', note: 'Знайомство за інтересами' },
  { value: 'date', icon: 'heart', title: 'Побачення', note: 'Романтичне знайомство' },
];

// "Лише подія" excludes the plans after the event, and any plan clears it.
const EVENT_ONLY = 'Лише подія';

const afterEventRows = [
  ['Прогулянка', 'Кава'],
  ['Вечеря', EVENT_ONLY],
];

const steps = ['Підберемо тобі компанію', 'Ознайомитесь із профілями', 'Гайда на подію!'];

// "01 Шторка" has a 34 px bottom padding; a larger bottom inset replaces it.
const SHEET_BOTTOM = 34;

function AfterEventChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-[18px] px-4 py-[9px] ${
        selected ? 'bg-brand-coral' : 'bg-surface-background'
      }`}
    >
      {selected && <Icon name="check-bold" size={16} color={colors.text['on-dark']} />}
      <Text className={`font-inter-medium text-label ${selected ? 'text-text-on-dark' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  // "Джаз-вечір у Мистецькому Арсеналі · Сб, 24 жовт".
  eventLabel: string;
  onSubmit: () => void;
};

export function CompanyRequestSheet({ visible, onClose, eventLabel, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  // Figma's initial choice: company for the evening, then a walk and coffee.
  const [companyType, setCompanyType] = useState<CompanyType>('evening');
  const [afterEvent, setAfterEvent] = useState(['Прогулянка', 'Кава']);
  const toggleAfterEvent = (label: string) =>
    setAfterEvent((current) => {
      if (current.includes(label)) return current.filter((value) => value !== label);
      if (label === EVENT_ONLY) return [EVENT_ONLY];
      return [...current.filter((value) => value !== EVENT_ONLY), label];
    });

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
      <Animated.View entering={SlideInDown.duration(250)} accessibilityViewIsModal>
        <View
          className="gap-6 rounded-t-[28px] bg-surface-card px-5 pt-3"
          style={{ paddingBottom: Math.max(SHEET_BOTTOM, insets.bottom) }}
        >
          <View className="items-center">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>

          <View className="gap-1.5">
            <Text className="font-inter text-caption text-text-secondary">{eventLabel}</Text>
            <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
              Що ти шукаєш?
            </Text>
          </View>

          <View accessibilityRole="radiogroup" className="gap-2.5">
            {companyTypes.map((option) => (
              <RadioOption
                key={option.value}
                icon={option.icon}
                title={option.title}
                note={option.note}
                selected={companyType === option.value}
                onPress={() => setCompanyType(option.value)}
              />
            ))}
          </View>

          <View className="gap-2.5">
            <Text className="font-inter-semibold text-title text-text-primary">Продовжимо після події?</Text>
            <View className="gap-2">
              {afterEventRows.map((row) => (
                <View key={row.join()} className="flex-row gap-2">
                  {row.map((label) => (
                    <AfterEventChip
                      key={label}
                      label={label}
                      selected={afterEvent.includes(label)}
                      onPress={() => toggleAfterEvent(label)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <View className="flex-row gap-2 rounded-[18px] bg-surface-background px-3 py-3.5">
            {steps.map((step, index) => (
              <View key={step} className="flex-1 items-center gap-1.5">
                <View className="size-6 items-center justify-center rounded-xl bg-brand-coral">
                  <Text className="font-inter-semibold text-tag text-text-on-dark">{index + 1}</Text>
                </View>
                <Text className="text-center font-inter text-[12px] leading-[18px] text-text-secondary">{step}</Text>
              </View>
            ))}
          </View>

          <Button label="Знайти мені метч" variant="dark" onPress={onSubmit} />
        </View>
      </Animated.View>
    </Overlay>
  );
}
