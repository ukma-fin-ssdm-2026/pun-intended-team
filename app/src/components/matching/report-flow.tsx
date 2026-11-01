// Written with the help of Claude
// AI Usage: report sheet and confirmation from the Figma "Д3 Скарга" and "Д3.1 Скаргу надіслано" frames; reviewed by
// Daryna Halytska.
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reportUser, type ReportReason } from '@/api/reports';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { mockPerson } from '@/mocks/matching';
import { colors, shadows } from '@/styles/tokens';

export const reportReasons: { value: ReportReason; label: string }[] = [
  { value: 'offensive_messages', label: 'Образливі повідомлення' },
  { value: 'no_show', label: 'Не прийшли на зустріч і не попередили' },
  { value: 'fake_profile', label: 'Фейковий профіль' },
  { value: 'unsafe_behaviour', label: 'Небезпечна поведінка' },
  { value: 'other', label: 'Інше' },
];

// Who is reported, in the forms the copy needs: "Поскаржитися на Олену", "Ви з Оленою". Without a username, as for the
// mock matches, the sheet is not sent to the API.
export type ReportedPerson = { name: string; accusative: string; instrumental: string; username?: string };

const nextSteps = (person: ReportedPerson): { icon: IconName; text: string }[] => [
  { icon: 'report-shield', text: 'Модератор розгляне скаргу протягом доби' },
  { icon: 'report-close', text: `Ви з ${person.instrumental} більше не потрапите в метчі одне одного` },
  { icon: 'report-bell', text: 'Ми повідомимо, коли буде рішення' },
];

// "01 Шторка" of Д3: 710 px high (from y=134 of the 844 px frame), with a 34 px bottom padding.
const SHEET_HEIGHT = 710;
const SHEET_BOTTOM = 34;
// Keeps the sheet under the status bar on shorter screens; its content scrolls there.
const SHEET_TOP_MARGIN = 40;

function ReasonRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      className="flex-row items-center gap-3 py-[13px]"
    >
      <Text className={`flex-1 text-body text-text-primary ${checked ? 'font-inter-medium' : 'font-inter'}`}>
        {label}
      </Text>
      {checked ? (
        <View className="size-[22px] items-center justify-center rounded-[7px] bg-brand-coral">
          <Icon name="checkbox-check" size={16} color={colors.text['on-dark']} />
        </View>
      ) : (
        <View className="size-[22px] rounded-[7px] border-[1.5px] border-border-default" />
      )}
    </Pressable>
  );
}

function ReportSheet({ person, onSent }: { person: ReportedPerson; onSent: () => void }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // The API takes one reason per report.
  const [reason, setReason] = useState<ReportReason>();
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!reason) return;
    if (!person.username) {
      onSent();
      return;
    }
    setSending(true);
    setError(undefined);
    const result = await reportUser({
      username: person.username,
      reason,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    setSending(false);
    if (result.ok) onSent();
    else if (result.status === 0) setError('Немає зʼєднання. Спробуй ще раз.');
    else if (result.code === 'REFERENCE_NOT_FOUND') setError(`${person.name} більше немає в Nearby.`);
    else if (result.code === 'CANNOT_REPORT_SELF') setError('Не можна поскаржитися на себе.');
    else setError('Не вдалося надіслати скаргу. Спробуй ще раз.');
  };

  return (
    // NativeWind maps className only on React Native's own components, so the layout sits on a View inside.
    <Animated.View entering={SlideInDown.duration(250)} accessibilityViewIsModal>
      <View
        className="rounded-t-[28px] bg-surface-card px-5 pt-3"
        style={{
          height: Math.min(SHEET_HEIGHT, windowHeight - SHEET_TOP_MARGIN),
          paddingBottom: Math.max(SHEET_BOTTOM, insets.bottom),
        }}
      >
        <ScrollView contentContainerClassName="gap-5" showsVerticalScrollIndicator={false}>
          <View className="items-center">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>

          <View className="items-center gap-2.5">
            <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
              <Icon name="danger" size={26} color={colors.text['on-dark']} />
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
              Поскаржитися на {person.accusative}
            </Text>
            <Text className="text-center font-inter text-caption text-text-secondary">
              {person.name} не дізнається, від кого скарга. Модератор побачить її протягом хвилини.
            </Text>
          </View>

          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            {reportReasons.map((option, index) => (
              <View key={option.value}>
                {index > 0 && <View className="h-px bg-border-default" />}
                <ReasonRow
                  label={option.label}
                  checked={reason === option.value}
                  onPress={() => setReason(option.value)}
                />
              </View>
            ))}
          </View>

          <View className="gap-1.5">
            <Text className="font-inter text-caption text-text-secondary">Коментар</Text>
            <TextInput
              accessibilityLabel="Коментар"
              multiline
              maxLength={1000}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
              className="min-h-[88px] rounded-2xl bg-surface-background px-4 py-3.5 font-inter text-body text-text-primary"
              // Hides the browser focus ring, as in the other fields.
              style={{ outlineWidth: 0 }}
            />
          </View>

          {error && <Text className="text-center font-inter text-caption text-brand-coral">{error}</Text>}
          <Button
            label="Надіслати скаргу"
            variant="dark"
            disabled={!reason}
            loading={sending}
            onPress={() => void submit()}
          />
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function ReportSentDialog({ person, onDone }: { person: ReportedPerson; onDone: () => void }) {
  return (
    <View
      accessibilityViewIsModal
      className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
      style={{ boxShadow: shadows.medium }}
    >
      <View className="items-center gap-2.5">
        <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
          <Icon name="report-sent-check" size={26} color={colors.text['on-dark']} />
        </View>
        <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
          Скаргу надіслано
        </Text>
        <Text className="text-center font-inter text-caption text-text-secondary">
          Дякуємо, що допомагаєш тримати Nearby безпечним. {person.name} не дізнається, від кого скарга.
        </Text>
      </View>
      <View className="rounded-[20px] bg-surface-background px-4 py-1">
        {nextSteps(person).map((step, index) => (
          <View key={step.icon}>
            {index > 0 && <View className="h-px bg-border-default" />}
            <View className="flex-row items-center gap-3 py-3">
              <View className="size-9 items-center justify-center rounded-[11px] bg-surface-card">
                <Icon name={step.icon} size={18} />
              </View>
              <Text className="flex-1 font-inter text-body text-text-primary">{step.text}</Text>
            </View>
          </View>
        ))}
      </View>
      <Button label="Зрозуміло" variant="dark" onPress={onDone} />
    </View>
  );
}

export type ReportStep = 'closed' | 'form' | 'sent';

type Props = {
  // The match by default (05, 07); a post's author on Т3.
  person?: ReportedPerson;
  step: ReportStep;
  onStepChange: (step: ReportStep) => void;
  // "Зрозуміло" on Д3.1; the prototype opens Т2 Метчі.
  onDone: () => void;
};

// One modal for both steps, so sending the report swaps the sheet for the dialog without closing and reopening it.
// A backdrop tap closes either step, as in the prototype.
export function ReportFlow({ person = mockPerson, step, onStepChange, onDone }: Props) {
  return (
    <Overlay
      visible={step !== 'closed'}
      onClose={() => onStepChange('closed')}
      placement={step === 'sent' ? 'center' : 'bottom'}
    >
      {step === 'sent' ? (
        <ReportSentDialog
          person={person}
          onDone={() => {
            onStepChange('closed');
            onDone();
          }}
        />
      ) : (
        <ReportSheet person={person} onSent={() => onStepChange('sent')} />
      )}
    </Overlay>
  );
}
