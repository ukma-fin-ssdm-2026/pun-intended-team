// Written with the help of Claude
// AI Usage: notifications screen from the Figma "Т5 Сповіщення" frame, on the inbox from the API; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  acceptListingRequest,
  declineListingRequest,
  getListingRequest,
  type ListingRequest,
} from '@/api/listing-requests';
import { loadNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications';
import { failureSnackbar } from '@/auth/messages';
import { joinRequestOf } from '@/components/announcements/join-request';
import { JoinRequestSheet } from '@/components/announcements/join-request-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { formatDateTime } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { notificationText, useNotificationsState, type Notification } from '@/state/notifications';
import { colors } from '@/styles/tokens';

// "01 Навігація": top padding 56 in the iPhone 14 frame, 9 px below its status bar.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;

type Tone = 'coral' | 'ink' | 'plain';

const tiles: Record<Tone, { box: string; icon: string }> = {
  coral: { box: 'bg-brand-coral', icon: colors.text['on-dark'] },
  ink: { box: 'bg-brand-ink', icon: colors.text['on-dark'] },
  plain: { box: 'bg-surface-background', icon: colors.text.primary },
};

// The tile of each type, as in the Figma frame; the matching ones open the Метчі tab.
const looks: Record<Notification['type'], { icon: IconName; tone: Tone; toMatches?: boolean }> = {
  match_proposed: { icon: 'matches', tone: 'ink', toMatches: true },
  match_mutual: { icon: 'check', tone: 'coral', toMatches: true },
  respond_soon: { icon: 'bell', tone: 'ink', toMatches: true },
  not_a_match: { icon: 'close', tone: 'plain', toMatches: true },
  continue_matching: { icon: 'matches', tone: 'plain', toMatches: true },
  removed_from_matching: { icon: 'close', tone: 'plain', toMatches: true },
  no_match_found: { icon: 'close', tone: 'plain', toMatches: true },
  event_reminder: { icon: 'bell', tone: 'plain' },
  event_changed: { icon: 'calendar', tone: 'plain' },
  report_received: { icon: 'shield', tone: 'plain' },
  listing_request: { icon: 'matches', tone: 'coral' },
  listing_request_accepted: { icon: 'check', tone: 'coral' },
};

type Row = { key: string; icon: IconName; tone: Tone; title: string; time: string; text: string; unread: boolean };

function NotificationRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const tile = tiles[row.tone];
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="flex-row items-start gap-3 py-3">
      <View className={`size-11 items-center justify-center rounded-[14px] ${tile.box}`}>
        <Icon name={row.icon} size={22} color={tile.icon} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 font-inter-medium text-body text-text-primary">{row.title}</Text>
          <Text className="font-inter text-caption text-text-secondary">{row.time}</Text>
        </View>
        <Text className="font-inter text-caption text-text-secondary">{row.text}</Text>
      </View>
      {row.unread && <View accessibilityLabel="Непрочитане" className="size-2 rounded-full bg-brand-coral" />}
    </Pressable>
  );
}

function toRow(notification: Notification): Row {
  const { icon, tone } = looks[notification.type];
  return {
    key: notification.id,
    icon,
    tone,
    ...notificationText(notification),
    time: formatDateTime(notification.createdAt),
    unread: notification.readAt === null,
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inbox = useNotificationsState();
  const { snackbar, show } = useSnackbar();
  // The Д4 sheet of a `listing_request` row, with the request from the API.
  const [request, setRequest] = useState<ListingRequest>();
  const [answering, setAnswering] = useState<'accept' | 'decline'>();
  useStatusBarStyle('dark');

  // The inbox is read when the screen opens (HLD I1); the web build has no push, so this is its only channel.
  useEffect(() => {
    void loadNotifications();
  }, []);

  const toMutual = (id: string) => router.push({ pathname: '/mutual', params: { request: id } });

  // A request already accepted goes straight to 07; a pending or declined one opens Д4, read-only once declined.
  const openRequest = async (id: string) => {
    const result = await getListingRequest(id);
    if (!result.ok) {
      show(
        result.status === 404
          ? { tone: 'error', title: 'Запиту вже немає', note: 'Оголошення видалено' }
          : failureSnackbar(result),
      );
    } else if (result.data.status === 'accepted') {
      toMutual(id);
    } else {
      setRequest(result.data);
    }
  };

  const answer = async (choice: 'accept' | 'decline') => {
    if (!request) return;
    setAnswering(choice);
    const result =
      choice === 'accept' ? await acceptListingRequest(request.id) : await declineListingRequest(request.id);
    setAnswering(undefined);
    if (!result.ok) {
      show(failureSnackbar(result));
      return;
    }
    setRequest(undefined);
    if (choice === 'accept') toMutual(request.id);
    else show({ title: 'Запит відхилено', note: `${request.requester.displayName} не отримає сповіщення` });
  };

  const open = (notification: Notification) => () => {
    void markNotificationRead(notification.id);
    const { eventId, listingRequestId } = notification.payload;
    // "No match found" opens the search screen of its event, which shows what to do next.
    if (notification.type === 'no_match_found' && typeof eventId === 'string') {
      router.push({ pathname: '/events/[id]/search', params: { id: eventId } });
    } else if (notification.type === 'listing_request' && typeof listingRequestId === 'string') {
      void openRequest(listingRequestId);
    } else if (notification.type === 'listing_request_accepted' && typeof listingRequestId === 'string') {
      toMutual(listingRequestId);
    } else if (looks[notification.type].toMatches) {
      router.dismissTo('/matches');
    }
  };

  const notifications = inbox.notifications ?? [];
  const fresh = notifications.filter(({ readAt }) => readAt === null);
  const earlier = notifications.filter(({ readAt }) => readAt !== null);

  const section = (label: string, items: Notification[]) =>
    items.length > 0 && (
      <View className="gap-1 px-5 pt-4">
        <Text className="font-inter-medium text-label text-text-secondary">{label}</Text>
        {items.map((item) => (
          <NotificationRow key={item.id} row={toRow(item)} onPress={open(item)} />
        ))}
      </View>
    );

  const message =
    inbox.status === 'error'
      ? 'Не вдалося завантажити сповіщення'
      : inbox.status === 'loaded' && notifications.length === 0
        ? 'Сповіщень поки немає'
        : undefined;

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Прочитати все"
          onPress={() => void markAllNotificationsRead()}
          className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
        >
          <Icon name="check" size={20} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(34, insets.bottom) }}>
        {message && <Text className="px-5 pt-8 text-center font-inter text-body text-text-secondary">{message}</Text>}
        {section('Нові', fresh)}
        {section('Раніше', earlier)}
      </ScrollView>
      {request && (
        <JoinRequestSheet
          visible
          request={joinRequestOf(request)}
          busy={answering}
          decided={
            request.status === 'declined' ? 'Запит уже відхилено. Про це ніхто не отримав сповіщення.' : undefined
          }
          onClose={() => setRequest(undefined)}
          onAccept={() => void answer('accept')}
          onDecline={() => void answer('decline')}
        />
      )}
      {snackbar && <Snackbar {...snackbar} />}
    </View>
  );
}
