// Written with the help of Claude
// AI Usage: company request sheet from the Figma "03 Запит на компанію" screen; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { actionFadeBottom, BottomActionFade } from '@/components/ui/bottom-action-fade';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { RadioOption } from '@/components/ui/radio-option';
import type { ApplicationAnswers } from '@/api/applications';
import { colors } from '@/styles/tokens';

type CompanyType = ApplicationAnswers['desiredCompany'];
type Plan = ApplicationAnswers['afterEventPlans'][number];

const companyTypes: { value: CompanyType; icon: IconName; title: string; note: string }[] = [
  { value: 'company', icon: 'ticket', title: 'Компанія на вечір', note: 'Сходити разом і поспілкуватися' },
  { value: 'friends', icon: 'matches', title: 'Нові друзі', note: 'Знайомство за інтересами' },
  { value: 'dating', icon: 'heart', title: 'Побачення', note: 'Романтичне знайомство' },
];

// "Лише подія" excludes the plans after the event, and any plan clears it; the API takes it as no plans.
const EVENT_ONLY = 'Лише подія';
const planLabels: Record<Plan, string> = { walk: 'Прогулянка', coffee: 'Кава', dinner: 'Вечеря' };
const plans = Object.keys(planLabels) as Plan[];

const afterEventRows = [
  [planLabels.walk, planLabels.coffee],
  [planLabels.dinner, EVENT_ONLY],
];

const steps = ['Підберемо тобі компанію', 'Ознайомитесь із профілями', 'Гайда на подію!'];

// "Зона закриття / верх": the top 43 px of the screen stay the backdrop, or the status bar when it is taller.
const TOP_CLOSE_ZONE = 43;
const BUTTON_HEIGHT = 52;
// "01 Шторка" spaces its blocks and the button 24 px apart.
const SECTION_GAP = 24;

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
  // The answers the sheet opens with; read when it is mounted.
  initial: ApplicationAnswers;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (answers: ApplicationAnswers) => void;
};

export function CompanyRequestSheet({
  visible,
  onClose,
  eventLabel,
  initial,
  submitLabel = 'Знайти мені метч',
  submitting = false,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [companyType, setCompanyType] = useState<CompanyType>(initial.desiredCompany);
  const [afterEvent, setAfterEvent] = useState(
    initial.afterEventPlans.length > 0 ? initial.afterEventPlans.map((plan) => planLabels[plan]) : [EVENT_ONLY],
  );
  const toggleAfterEvent = (label: string) =>
    setAfterEvent((current) => {
      if (current.includes(label)) return current.filter((value) => value !== label);
      if (label === EVENT_ONLY) return [EVENT_ONLY];
      return [...current.filter((value) => value !== EVENT_ONLY), label];
    });

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
      <Animated.View
        entering={SlideInDown.duration(250)}
        accessibilityViewIsModal
        style={{ maxHeight: height - Math.max(TOP_CLOSE_ZONE, insets.top) }}
      >
        {/* A tall sheet scrolls under its button, which stays pinned over a white fade. */}
        <View className="shrink rounded-t-[28px] bg-surface-card pt-3">
          <View className="items-center pb-6">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>
          <ScrollView
            className="shrink"
            contentContainerClassName="gap-6 px-5"
            contentContainerStyle={{ paddingBottom: SECTION_GAP + BUTTON_HEIGHT + actionFadeBottom(insets.bottom) }}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>

          <BottomActionFade id="request-action-fade">
            <Button
              label={submitLabel}
              variant="dark"
              loading={submitting}
              onPress={() =>
                onSubmit({
                  desiredCompany: companyType,
                  afterEventPlans: plans.filter((plan) => afterEvent.includes(planLabels[plan])),
                })
              }
            />
          </BottomActionFade>
        </View>
      </Animated.View>
    </Overlay>
  );
}
