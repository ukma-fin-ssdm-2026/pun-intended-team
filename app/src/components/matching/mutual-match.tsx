// Written with the help of Claude
// AI Usage: mutual match from the Figma "07 Взаємний метч" frame and its title variants; reviewed by Daryna Halytska.
import type { ImageSource } from 'expo-image';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomActionFade } from '@/components/ui/bottom-action-fade';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import type { ApiImage } from '@/api/images';
import type { components } from '@/api/schema';
import { ApiPicture } from '@/components/pictures/picture';
import { EventCover } from '@/components/ui/event-cover';
import { Icon, type IconName } from '@/components/ui/icon';
import { SocialNetworkIcon } from '@/components/ui/social-network-icon';
import { formatSessionDay } from '@/dates';
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

function Avatar({ initial, photo, className = '' }: { initial: string; photo?: ApiImage | null; className?: string }) {
  return (
    <View
      className={`size-[88px] items-center justify-center overflow-hidden rounded-full border-4 border-brand-ink bg-surface-background ${className}`}
    >
      {photo ? (
        <ApiPicture image={photo} />
      ) : (
        <Text className="font-inter-bold text-display text-text-secondary">{initial}</Text>
      )}
    </View>
  );
}

export type MutualContact = {
  key: string;
  // A network's logo, or an icon such as the phone.
  icon: { network: components['schemas']['SocialNetwork'] } | { name: IconName };
  label: string;
  value: string;
  // Where its button leads, e.g. the profile link; without one the button is shown but does nothing.
  url?: string;
};

// The other user. A name from the API comes in one form only, so the lines that decline it are left out without the
// other forms.
export type MutualPerson = {
  name: string;
  initial: string;
  photo?: ApiImage | null;
  instrumental?: string;
  genitive?: string;
  contacts: MutualContact[];
};

export type MutualEvent = {
  id: string;
  title: string;
  startsAt: string;
  startTimeKnown: boolean;
  cover?: ImageSource | number;
};

type HeroProps = {
  title: MutualTitle;
  // The match, the caller's own initial and the event they go to together, on the day they share.
  person: MutualPerson;
  ownInitial: string;
  ownPhoto?: ApiImage | null;
  event: MutualEvent;
  onBack?: () => void;
  onMore?: () => void;
};

// The gradient header; the component gallery shows it with each title.
export function MutualMatchHero({ title, person, ownInitial, ownPhoto, event, onBack, onMore }: HeroProps) {
  const insets = useSafeAreaInsets();
  const when = formatSessionDay(event.startsAt, event.startTimeKnown);
  const together = person.instrumental ? `Ви з ${person.instrumental} йдете` : 'Ви йдете разом';

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
        <Avatar initial={ownInitial} photo={ownPhoto} className="-mr-5" />
        <Avatar initial={person.initial} photo={person.photo} />
        <View className="absolute left-[60px] top-[58px] size-9 items-center justify-center rounded-[18px] bg-brand-coral">
          <Icon name="mutual-check" size={20} color={colors.text['on-dark']} />
        </View>
      </View>
      <Text accessibilityRole="header" className="text-center font-inter-bold text-display text-text-on-dark">
        {title}
      </Text>
      <Text className="text-center font-inter text-caption text-text-on-dark-muted">
        {together} на «{event.title}» · {when}
      </Text>
    </View>
  );
}

function ContactRow({ contact }: { contact: MutualContact }) {
  const { icon, label, value, url } = contact;
  return (
    <View className="flex-row items-center gap-3.5 py-3.5">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-card">
        {'network' in icon ? (
          <SocialNetworkIcon network={icon.network} size={20} color={colors.brand.coral} />
        ) : (
          <Icon name={icon.name} size={20} color={colors.brand.coral} />
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter text-caption text-text-secondary">{label}</Text>
        <Text className="font-inter-medium text-body text-text-primary">{value}</Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Відкрити ${label}`}
        disabled={!url}
        onPress={() => url && void Linking.openURL(url)}
        className="size-9 items-center justify-center rounded-[18px] bg-brand-ink"
      >
        <Icon name="arrow-long" size={18} color={colors.text['on-dark']} />
      </Pressable>
    </View>
  );
}

type Props = HeroProps & {
  onEventPress: () => void;
};

export function MutualMatch({ title, person, ownInitial, ownPhoto, event, onBack, onMore, onEventPress }: Props) {
  const insets = useSafeAreaInsets();
  const actionBottom = Math.max(ACTION_BOTTOM, insets.bottom);
  // "Написати в Telegram" in Figma: the first contact with a link.
  const write = person.contacts.find(({ url }) => url);

  return (
    <View className="flex-1 bg-surface-card">
      <ScrollView>
        <MutualMatchHero
          title={title}
          person={person}
          ownInitial={ownInitial}
          ownPhoto={ownPhoto}
          event={event}
          onBack={onBack}
          onMore={onMore}
        />
        <View
          className="gap-4 rounded-t-[28px] bg-surface-card px-5 pt-6"
          style={{ marginTop: -SHEET_OVERLAP, paddingBottom: CONTACTS_BOTTOM - ACTION_BOTTOM + actionBottom }}
        >
          <Text className="font-inter-semibold text-title text-text-primary">
            {person.genitive ? `Контакти ${person.genitive}` : 'Контакти'}
          </Text>
          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            {person.contacts.map((contact, index) => (
              <View key={contact.key}>
                {index > 0 && <View className="h-px bg-border-default" />}
                <ContactRow contact={contact} />
              </View>
            ))}
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
              <EventCover cover={event.cover} />
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

      {write && (
        <BottomActionFade id="mutual-action-fade" style={{ alignItems: 'center' }}>
          <Button
            label={`Написати в ${write.label}`}
            variant="dark"
            onPress={() => write.url && void Linking.openURL(write.url)}
          />
        </BottomActionFade>
      )}
    </View>
  );
}
