// Written with the help of Claude
// AI Usage: mutual match from the Figma "07 Взаємний метч" frame and its title variants; reviewed by Daryna Halytska.
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon, type IconName } from '@/components/ui/icon';
import { formatShortDay, formatTime } from '@/dates';
import type { MockEvent } from '@/mocks/events';
import { mockMutual, type MatchPerson } from '@/mocks/matching';
import { colors } from '@/styles/tokens';

// "01 Шапка": top padding 56 in the iPhone 14 frame (9 px below its status bar), 52 at the bottom, of which the contacts
// sheet covers 28.
const HEADER_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const SHEET_OVERLAP = 28;
// "03 Дія" sits 34 px above the bottom; the contacts keep 130 px under them for it.
const ACTION_BOTTOM = 34;
const CONTACTS_BOTTOM = 130;

// The 07 frame and its variants differ only in this line; which one fits a match is decided later.
export const mutualTitles = ['Це взаємно!', 'Концерту бути!', 'Вечір врятовано!', 'Гірко!'] as const;
export type MutualTitle = (typeof mutualTitles)[number];

const navButton = 'size-10 items-center justify-center rounded-[20px] bg-white/[0.14]';

function Avatar({ initial, className = '' }: { initial: string; className?: string }) {
  return (
    <View
      className={`size-[88px] items-center justify-center rounded-full border-4 border-brand-ink bg-surface-background ${className}`}
    >
      <Text className="font-inter-bold text-display text-text-secondary">{initial}</Text>
    </View>
  );
}

type HeroProps = {
  title: MutualTitle;
  // The match and the event they go to together.
  person: MatchPerson;
  event: MockEvent;
  onBack?: () => void;
  onMore?: () => void;
};

// The gradient header; the component gallery shows it with each title.
export function MutualMatchHero({ title, person, event, onBack, onMore }: HeroProps) {
  const insets = useSafeAreaInsets();
  const when = `${formatShortDay(event.startsAt)}, ${formatTime(event.startsAt)}`;

  return (
    <View
      className="items-center gap-4 overflow-hidden px-5 pb-[52px]"
      style={{ paddingTop: Math.max(HEADER_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
    >
      <View className="absolute inset-0">
        <CoralGradient preset="mutual" />
      </View>
      <View className="w-full flex-row justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={onBack} className={navButton}>
          <Icon name="arrow-left" size={20} color={colors.text['on-dark']} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ще" onPress={onMore} className={navButton}>
          <Icon name="menu-dots" size={20} color={colors.text['on-dark']} />
        </Pressable>
      </View>
      <View className="flex-row items-center">
        <Avatar initial={mockMutual.ownInitial} className="-mr-5" />
        <Avatar initial={person.initial} />
        <View className="absolute left-[60px] top-[58px] size-9 items-center justify-center rounded-[18px] bg-brand-coral">
          <Icon name="mutual-check" size={20} color={colors.text['on-dark']} />
        </View>
      </View>
      <Text accessibilityRole="header" className="text-center font-inter-bold text-display text-text-on-dark">
        {title}
      </Text>
      <Text className="text-center font-inter text-caption text-text-on-dark-muted">
        Ви з {person.instrumental} йдете на «{event.title}» · {when}
      </Text>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  action,
}: {
  icon: IconName;
  label: string;
  value: string;
  action: IconName;
}) {
  return (
    <View className="flex-row items-center gap-3.5 py-3.5">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-card">
        <Icon name={icon} size={20} color={colors.brand.coral} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter text-caption text-text-secondary">{label}</Text>
        <Text className="font-inter-medium text-body text-text-primary">{value}</Text>
      </View>
      {/* No prototype link: the buttons are shown as in Figma. */}
      <View className="size-9 items-center justify-center rounded-[18px] bg-brand-ink">
        <Icon name={action} size={18} color={colors.text['on-dark']} />
      </View>
    </View>
  );
}

type Props = HeroProps & {
  onEventPress: () => void;
};

export function MutualMatch({ title, person, event, onBack, onMore, onEventPress }: Props) {
  const insets = useSafeAreaInsets();
  const actionBottom = Math.max(ACTION_BOTTOM, insets.bottom);

  return (
    <View className="flex-1 bg-surface-card">
      <ScrollView>
        <MutualMatchHero title={title} person={person} event={event} onBack={onBack} onMore={onMore} />
        <View
          className="gap-4 rounded-t-[28px] bg-surface-card px-5 pt-6"
          style={{ marginTop: -SHEET_OVERLAP, paddingBottom: CONTACTS_BOTTOM - ACTION_BOTTOM + actionBottom }}
        >
          <Text className="font-inter-semibold text-title text-text-primary">Контакти {person.genitive}</Text>
          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            <ContactRow icon="send" label="Telegram" value={person.telegram} action="arrow-long" />
            <View className="h-px bg-border-default" />
            <ContactRow icon="phone" label="Телефон" value={person.phone} action="copy" />
          </View>
          <Text className="font-inter text-caption text-text-secondary">
            {person.name} теж бачить твої контакти. Бігом домовляйтесь про зустріч!
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={event.title}
            onPress={onEventPress}
            className="flex-row items-center gap-3 rounded-[20px] border border-border-default py-3 pl-3 pr-4"
          >
            <View className="size-11 overflow-hidden rounded-xl">
              {event.cover ? (
                <Image source={event.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <CoralGradient preset="cover" />
              )}
            </View>
            <View className="flex-1 gap-0.5">
              <Text numberOfLines={1} className="font-inter-medium text-label text-text-primary">
                {event.title}
              </Text>
              <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
                Нагадаємо за день до події
              </Text>
            </View>
            <Icon name="arrow-right" size={20} color={colors.text.secondary} />
          </Pressable>
        </View>
      </ScrollView>

      {/* No prototype link: shown as in Figma. */}
      <View className="absolute left-0 right-0 items-center" style={{ bottom: actionBottom }}>
        <Button label="Написати в Telegram" variant="dark" />
      </View>
    </View>
  );
}
