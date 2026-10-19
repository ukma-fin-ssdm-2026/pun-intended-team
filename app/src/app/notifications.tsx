// Written with the help of Claude
// AI Usage: notifications screen from the Figma "Т5 Сповіщення" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockMatchesTab, mockSearch } from '@/mocks/matching';
import { colors } from '@/styles/tokens';

// "01 Навігація": top padding 56 in the iPhone 14 frame, 9 px below its status bar.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;

type Tone = 'coral' | 'ink' | 'plain';

type Notification = {
  icon: IconName;
  tone: Tone;
  title: string;
  time: string;
  text: string;
  unread?: boolean;
  // Where the prototype goes; "Скаргу отримано" has no link.
  href?: Href;
  // "Не цього разу" returns to the Метчі tab instead of opening a new screen.
  toMatches?: boolean;
};

const tiles: Record<Tone, { box: string; icon: string }> = {
  coral: { box: 'bg-brand-coral', icon: colors.text['on-dark'] },
  ink: { box: 'bg-brand-ink', icon: colors.text['on-dark'] },
  plain: { box: 'bg-surface-background', icon: colors.text.primary },
};

const fresh: Notification[] = [
  {
    icon: 'check',
    tone: 'coral',
    title: 'Це взаємно!',
    time: '5 хв',
    text: 'Максим теж прийняв метч на «Квартирник». Контакти відкрито.',
    unread: true,
    // The safety reminder (06) over Максим's mutual match (07).
    href: { pathname: '/mutual', params: { person: 'maksym', safety: '1' } },
  },
  {
    icon: 'matches',
    tone: 'ink',
    title: 'Новий метч',
    time: '2 год',
    text: 'Знайшли тобі компанію на «Джаз-вечір у Мистецькому Арсеналі».',
    unread: true,
    href: '/proposal',
  },
];

const earlier: Notification[] = [
  {
    icon: 'calendar',
    tone: 'plain',
    title: 'Подію змінено',
    time: 'вчора',
    text: '«Кераміка для початківців» переноситься на 18:30.',
    // The prototype opens the event page frame, which shows the jazz evening.
    href: { pathname: '/events/[id]', params: { id: mockSearch.eventId } },
  },
  {
    icon: 'bell',
    tone: 'plain',
    title: 'Нагадування',
    time: '2 дні',
    text: 'Завтра о 16:00 «Як читати сучасне мистецтво».',
    href: { pathname: '/events/[id]', params: { id: mockMatchesTab.search.eventId } },
  },
  {
    icon: 'close',
    tone: 'plain',
    title: 'Не цього разу',
    time: '3 дні',
    text: 'Пропозиція на «Нічний показ» не склалася. Шукаємо далі.',
    toMatches: true,
  },
  {
    icon: 'shield',
    tone: 'plain',
    title: 'Скаргу отримано',
    time: '4 дні',
    text: 'Дякуємо. Модератор розгляне її найближчим часом.',
  },
];

function NotificationRow({ item, onPress }: { item: Notification; onPress?: () => void }) {
  const tile = tiles[item.tone];
  const content = (
    <>
      <View className={`size-11 items-center justify-center rounded-[14px] ${tile.box}`}>
        <Icon name={item.icon} size={22} color={tile.icon} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 font-inter-medium text-body text-text-primary">{item.title}</Text>
          <Text className="font-inter text-caption text-text-secondary">{item.time}</Text>
        </View>
        <Text className="font-inter text-caption text-text-secondary">{item.text}</Text>
      </View>
      {item.unread && <View className="size-2 rounded-full bg-brand-coral" />}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="link" onPress={onPress} className="flex-row items-start gap-3 py-3">
      {content}
    </Pressable>
  ) : (
    <View className="flex-row items-start gap-3 py-3">{content}</View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useStatusBarStyle('dark');

  const open = (item: Notification) => {
    if (item.toMatches) return () => router.dismissTo('/matches');
    const href = item.href;
    return href ? () => router.push(href) : undefined;
  };

  const section = (label: string, items: Notification[]) => (
    <View className="gap-1 px-5 pt-4">
      <Text className="font-inter-medium text-label text-text-secondary">{label}</Text>
      {items.map((item) => (
        <NotificationRow key={item.title} item={item} onPress={open(item)} />
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-surface-card">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-row items-center gap-3 px-5 pb-2"
        style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-inter-semibold text-title text-text-primary"
        >
          Сповіщення
        </Text>
        {/* "Прочитати все" has no prototype link; shown as in Figma. */}
        <View className="size-10 items-center justify-center rounded-[20px] bg-surface-background">
          <Icon name="check" size={20} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(34, insets.bottom) }}>
        {section('Нові', fresh)}
        {section('Раніше', earlier)}
      </ScrollView>
    </View>
  );
}
