// Written with the help of Claude
// AI Usage: shared parts of the Figma profile forms ("П1 Редагувати профіль", "В7" and "В8 Заповнення профілю");
// reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { components } from '@/api/schema';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { RadioOption } from '@/components/ui/radio-option';
import { Toggle } from '@/components/ui/toggle';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { colors } from '@/styles/tokens';

// "01 Навігація": top padding 56 in the iPhone 14 frame (9 px below its status bar). "04 Дія": padding 16 / 20 / 34 / 20
// around the 52 px button; the form keeps 110 px under it.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const ACTION_TOP = 16;
const ACTION_BOTTOM = 34;
const BUTTON_HEIGHT = 52;
const FORM_BOTTOM_GAP = 110 - (ACTION_TOP + BUTTON_HEIGHT + ACTION_BOTTOM) + 34;

type Interest = components['schemas']['Interest'];
type CommunicationFormat = components['schemas']['CommunicationFormat'];

export const MIN_INTERESTS = 3;

// As the API checks it.
export function isValidUsername(username: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._]{2,29}$/.test(username.trim());
}

type NavProps =
  // П1: a title between the back button and the spacer.
  | { title: string; step?: never }
  // В7, В8: "Крок 1 з 2", the progress bar and "Чернетку збережено".
  | { step: { current: number; total: number }; title?: never };

function FormNav({ title, step }: Readonly<NavProps>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="gap-2 px-5 pb-4" style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        {step ? (
          <Text className="font-inter-medium text-label text-text-primary">
            Крок {step.current} з {step.total}
          </Text>
        ) : (
          <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-primary">
            {title}
          </Text>
        )}
        <View className="size-10" />
      </View>
      {step && (
        <>
          <View className="flex-row gap-1.5">
            {Array.from({ length: step.total }, (_, index) => (
              <View
                key={index}
                className={`h-1 flex-1 rounded-sm ${index < step.current ? 'bg-brand-coral' : 'bg-border-default'}`}
              />
            ))}
          </View>
          <View className="flex-row justify-end overflow-hidden">
            <Text className="font-inter text-caption text-text-secondary">Чернетку збережено</Text>
          </View>
        </>
      )}
    </View>
  );
}

type FormScreenProps = NavProps & {
  children: ReactNode;
  action: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
};

// A white form under the navigation, with the screen's main button pinned to the bottom.
export function FormScreen({ action, children, ...nav }: Readonly<FormScreenProps>) {
  const insets = useSafeAreaInsets();
  useStatusBarStyle('dark');
  const actionBottom = Math.max(ACTION_BOTTOM, insets.bottom);

  return (
    <View className="flex-1 bg-surface-card">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: ACTION_TOP + BUTTON_HEIGHT + actionBottom + FORM_BOTTOM_GAP - ACTION_BOTTOM,
        }}
      >
        <FormNav {...(nav as NavProps)} />
        {children}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-surface-card px-5"
        style={{ paddingTop: ACTION_TOP, paddingBottom: actionBottom }}
      >
        <Button
          label={action.label}
          variant="dark"
          onPress={action.onPress}
          disabled={action.disabled}
          loading={action.loading}
        />
      </View>
    </View>
  );
}

// "02 Фото": the default cover with "Обкладинка", and the empty avatar overlapping its bottom 48 px.
export function ProfilePhoto() {
  return (
    <View className="px-5">
      <View className="h-[108px] items-end overflow-hidden rounded-[22px] pr-3 pt-3" style={{ marginBottom: -48 }}>
        <View className="absolute inset-0">
          <CoralGradient preset="profileCover" />
        </View>
        {/* "Змінити обкладинку" has no prototype link; shown as in Figma. */}
        <Glass
          className="flex-row items-center gap-1.5 py-[7px] pl-2.5 pr-3"
          radius={16}
          fill="rgba(255, 255, 255, 0.16)"
          border="rgba(255, 255, 255, 0.25)"
          tone="light"
        >
          <View className="flex-row items-center gap-1.5">
            <Icon name="gallery-edit" size={16} color={colors.text['on-dark']} />
            <Text className="font-inter-semibold text-tag text-text-on-dark">Обкладинка</Text>
          </View>
        </Glass>
      </View>
      <View className="pl-4">
        <View className="size-[92px] items-center justify-center rounded-full border-4 border-surface-card bg-surface-background">
          <Icon name="camera" size={28} color={colors.text.secondary} />
          <View className="absolute left-16 top-16 size-[30px] items-center justify-center rounded-[15px] border-[3px] border-surface-card bg-brand-coral">
            <Text className="font-inter-semibold text-[18px] leading-6 text-text-on-dark">+</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

type InterestPickerProps = {
  options: Interest[];
  // Interest ids.
  selected: string[];
  onToggle: (id: string) => void;
  // The note on the right of "Інтереси *", e.g. "обрано 3".
  note: string;
  // "+ ще" opens П1.2 on П1; without a handler it does nothing, as on В7.
  onMore?: () => void;
};

// "Інтереси": selected chips are dark with a check; "+ ще" ends the list.
export function InterestPicker({ options, selected, onToggle, note, onMore }: Readonly<InterestPickerProps>) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-start justify-between">
        {/* Both texts keep one line, as in Figma, so the note never wraps under the title. */}
        <Text numberOfLines={1} className="shrink-0 font-inter-semibold text-title text-text-primary">
          Інтереси <Text className="text-brand-coral">*</Text>
        </Text>
        <Text numberOfLines={1} className="shrink-0 font-inter text-caption text-text-secondary">
          {note}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {options.map((interest) => {
          const isSelected = selected.includes(interest.id);
          return (
            <Pressable
              key={interest.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onToggle(interest.id)}
              className={`flex-row items-center gap-1.5 rounded-[18px] py-2 pr-3.5 ${
                isSelected ? 'bg-brand-ink pl-2.5' : 'bg-surface-background pl-3.5'
              }`}
            >
              {isSelected && <Icon name="chip-check" size={14} color={colors.text['on-dark']} />}
              <Text
                className={`font-inter-medium text-label ${isSelected ? 'text-text-on-dark' : 'text-text-primary'}`}
              >
                {interest.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          disabled={!onMore}
          onPress={onMore}
          className="rounded-[18px] bg-surface-background px-3.5 py-2"
        >
          <Text className="font-inter-medium text-label text-text-primary">+ ще</Text>
        </Pressable>
      </View>
    </View>
  );
}

// The first `count` interests, then any chosen from the full list on "+ ще".
export function interestChips(all: Interest[], selected: string[], count: number): Interest[] {
  const first = all.slice(0, count);
  return [...first, ...all.slice(count).filter((interest) => selected.includes(interest.id))];
}

const formats: { value: CommunicationFormat; title: string; icon: IconName }[] = [
  { value: 'friends', title: 'Нові друзі', icon: 'user' },
  { value: 'dating', title: 'Побачення', icon: 'heart' },
  { value: 'company', title: 'Компанія на подію', icon: 'ticket' },
];

export function FormatPicker({
  value,
  onChange,
}: Readonly<{
  value: CommunicationFormat | null;
  onChange: (value: CommunicationFormat) => void;
}>) {
  return (
    <View className="gap-2.5">
      <Text className="font-inter-semibold text-title text-text-primary">
        Кого шукаєш? <Text className="text-brand-coral">*</Text>
      </Text>
      <View accessibilityRole="radiogroup" className="gap-2.5">
        {formats.map((format) => (
          <RadioOption
            key={format.value}
            icon={format.icon}
            title={format.title}
            selected={value === format.value}
            onPress={() => onChange(format.value)}
          />
        ))}
      </View>
    </View>
  );
}

export function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function VisibilityRow({
  icon,
  title,
  note,
  value,
  onValueChange,
}: Readonly<{
  icon: IconName;
  title: string;
  note: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}>) {
  return (
    <View className="flex-row items-center gap-3 overflow-hidden py-3">
      <View className="size-9 items-center justify-center overflow-hidden rounded-[11px] bg-surface-background">
        <Icon name={icon} size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
        <Text className="font-inter text-caption text-text-secondary">{note}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

type ContactVisibilityProps = {
  telegram: string;
  showTelegram: boolean;
  onShowTelegramChange: (value: boolean) => void;
  // Hidden while sign-in is Google-only (ADR-004): there is no verified phone number.
  // showPhone: boolean;
  // onShowPhoneChange: (value: boolean) => void;
};

// "Що побачить взаємний метч": which contacts a mutual match gets.
export function ContactVisibility({ telegram, showTelegram, onShowTelegramChange }: Readonly<ContactVisibilityProps>) {
  return (
    <View className="overflow-hidden rounded-[20px] bg-surface-card px-4 py-1">
      <View className="pb-1 pt-3">
        <Text className="font-inter-medium text-label text-text-secondary">Що побачить взаємний метч</Text>
      </View>
      <VisibilityRow
        icon="contact-send"
        title="Telegram"
        note={telegram}
        value={showTelegram}
        onValueChange={onShowTelegramChange}
      />
      {/* Hidden while sign-in is Google-only (ADR-004): there is no verified phone number.
      <View className="h-px bg-border-default" />
      <VisibilityRow
        icon="contact-phone"
        title="Номер телефону"
        note="Можна ввімкнути пізніше в профілі"
        value={showPhone}
        onValueChange={onShowPhoneChange}
      /> */}
    </View>
  );
}
