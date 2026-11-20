// Written with the help of Claude
// AI Usage: company request sheet from the Figma "03 Запит на компанію" screen; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { actionFadeBottom, BottomActionFade } from '@/components/ui/bottom-action-fade';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { RadioOption } from '@/components/ui/radio-option';
import { RangeSlider } from '@/components/ui/range-slider';
import type { ApplicationAnswers } from '@/api/applications';
import { plural } from '@/plural';
import { colors } from '@/styles/tokens';

type CompanyType = ApplicationAnswers['desiredCompany'];
type Plan = ApplicationAnswers['afterEventPlans'][number];
type PreferredGender = ApplicationAnswers['preferredGender'];

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

// "З ким хочеш піти?": anyone, or only women or only men.
const genderChoices: { value: PreferredGender; label: string }[] = [
  { value: 'any', label: 'Будь-хто' },
  { value: 'female', label: 'Жінка' },
  { value: 'male', label: 'Чоловік' },
];

// "Вік": 18 to 60, where 60 is "60+", sent as no upper bound.
const AGE_MIN = 18;
const AGE_TOP = 60;

const ageText = (age: number) => (age >= AGE_TOP ? `${AGE_TOP}+` : String(age));

// "20–30 років", "25–60+ років" without an upper bound (`high` null); one age alone takes its own form: "21 рік".
export function ageRangeLabel(low: number, high: number | null) {
  if (high === null) return low >= AGE_TOP ? `${AGE_TOP}+ років` : `${low}–${AGE_TOP}+ років`;
  if (low === high) return `${low} ${plural(low, ['рік', 'роки', 'років'])}`;
  return `${low}–${high} років`;
}

const steps = ['Підберемо тобі компанію', 'Ознайомитесь із профілями', 'Гайда на подію!'];

// "Зона закриття / верх": the top 43 px of the screen stay the backdrop, or the status bar when it is taller.
const TOP_CLOSE_ZONE = 43;
const BUTTON_HEIGHT = 52;
// "01 Шторка" spaces its blocks and the button 24 px apart.
const SECTION_GAP = 24;
const SIDE_PADDING = 20;

// A chip of 03: coral with a check when picked. The plans after the event are checkboxes, the genders radio buttons.
function AnswerChip({
  label,
  selected,
  onPress,
  role = 'checkbox',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'checkbox' | 'radio';
}) {
  return (
    <Pressable
      accessibilityRole={role}
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
  const [preferredGender, setPreferredGender] = useState<PreferredGender>(initial.preferredGender);
  const [ageMin, setAgeMin] = useState(initial.ageMin);
  // Null: no upper bound, the max handle at "60+".
  const [ageMax, setAgeMax] = useState(initial.ageMax);
  const toggleAfterEvent = (label: string) =>
    setAfterEvent((current) => {
      if (current.includes(label)) return current.filter((value) => value !== label);
      if (label === EVENT_ONLY) return [EVENT_ONLY];
      return [...current.filter((value) => value !== EVENT_ONLY), label];
    });

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* A modal is outside the app's gesture root on Android; the age handles need one of their own. */}
      <GestureHandlerRootView>
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
            {/* Gesture handler's scroll view, so a drag that starts on an age handle stays with the handle. NativeWind maps
              className only on React Native's own components, hence the plain styles. */}
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{
                gap: SECTION_GAP,
                paddingHorizontal: SIDE_PADDING,
                paddingBottom: SECTION_GAP + BUTTON_HEIGHT + actionFadeBottom(insets.bottom),
              }}
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
                        <AnswerChip
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

              {/* "01.4 З ким хочеш піти": both are hard filters, so the defaults leave nobody out. */}
              <View className="gap-4">
                <Text className="font-inter-semibold text-title text-text-primary">З ким хочеш піти?</Text>
                <View accessibilityRole="radiogroup" className="flex-row gap-2">
                  {genderChoices.map((choice) => (
                    <AnswerChip
                      key={choice.value}
                      role="radio"
                      label={choice.label}
                      selected={preferredGender === choice.value}
                      onPress={() => setPreferredGender(choice.value)}
                    />
                  ))}
                </View>
                <View className="gap-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-inter text-caption text-text-secondary">Вік</Text>
                    <Text className="font-inter-semibold text-[14px] leading-[18px] text-text-primary">
                      {ageRangeLabel(ageMin, ageMax)}
                    </Text>
                  </View>
                  <RangeSlider
                    min={AGE_MIN}
                    max={AGE_TOP}
                    low={ageMin}
                    high={ageMax ?? AGE_TOP}
                    onChange={(low, high) => {
                      setAgeMin(low);
                      setAgeMax(high >= AGE_TOP ? null : high);
                    }}
                    labels={{ low: 'Вік від', high: 'Вік до' }}
                    valueText={ageText}
                  />
                  <View className="flex-row justify-between">
                    <Text className="font-inter text-[12px] leading-4 text-text-secondary">{AGE_MIN}</Text>
                    <Text className="font-inter text-[12px] leading-4 text-text-secondary">{AGE_TOP}+</Text>
                  </View>
                </View>
              </View>

              <View className="flex-row gap-2 rounded-[18px] bg-surface-background px-3 py-3.5">
                {steps.map((step, index) => (
                  <View key={step} className="flex-1 items-center gap-1.5">
                    <View className="size-6 items-center justify-center rounded-xl bg-brand-coral">
                      <Text className="font-inter-semibold text-tag text-text-on-dark">{index + 1}</Text>
                    </View>
                    <Text className="text-center font-inter text-[12px] leading-[18px] text-text-secondary">
                      {step}
                    </Text>
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
                    preferredGender,
                    ageMin,
                    ageMax,
                  })
                }
              />
            </BottomActionFade>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Overlay>
  );
}
