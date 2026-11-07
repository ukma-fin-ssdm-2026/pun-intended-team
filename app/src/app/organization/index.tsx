// Written with the help of Claude
// AI Usage: organization events screen from the Figma "О1 Організація · Мої події" frame with the О3 sheet; reviewed by
// Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cancelEvent, type Event } from '@/api/events';
import { CancelEventSheet } from '@/components/organization/cancel-event-sheet';
import { eventFailure } from '@/components/organization/event-messages';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockOrganization, type OrganizationEventStatus } from '@/mocks/organization';
import { plural } from '@/plural';
import { rememberOwnEvent, useOwnEvents } from '@/state/organization-events';
import { useSession } from '@/state/session';
import { colors, shadows } from '@/styles/tokens';

// "01 Шапка": padding 56 / 20 / 52 (9 px below the iPhone 14 status bar at the top); the list covers its bottom 28 px.
const HEADER_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const LIST_OVERLAP = 28;

// A row of the list. The API has no list of an organization's own events: the events created, changed or cancelled
// since sign-in are `live` rows, from the API's answers, and the rest are the mock rows of the prototype, which the API
// does not know. Remove the mock rows when it has such a list.
type Row = {
  status: OrganizationEventStatus;
  live: boolean;
  event: Pick<Event, 'id' | 'title' | 'startsAt'> & { cover?: ImageSource; shortTitle?: string };
};

const statuses: Record<OrganizationEventStatus, { label: string; dot: string }> = {
  // The green of the "Опубліковано" dot is not a Figma variable.
  published: { label: 'Опубліковано', dot: '#22C55E' },
  draft: { label: 'Чернетка', dot: colors.text.secondary },
  cancelled: { label: 'Скасовано', dot: colors.brand.coral },
};

function CardAction({ label, dark, onPress }: { label: string; dark?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-1 items-center rounded-2xl py-2.5 ${dark ? 'bg-brand-ink' : 'bg-surface-background'}`}
    >
      <Text className={`font-inter-medium text-label ${dark ? 'text-text-on-dark' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function EventRow({ item, onEdit, onCancel }: { item: Row; onEdit: () => void; onCancel: () => void }) {
  const { status, event } = item;
  const { label, dot } = statuses[status];

  return (
    <View className="gap-3 rounded-[24px] bg-surface-card p-3" style={{ boxShadow: shadows.small }}>
      <View className="flex-row items-center gap-3">
        <View className={`size-[94px] overflow-hidden rounded-2xl ${status === 'cancelled' ? 'opacity-50' : ''}`}>
          {event.cover ? (
            <Image source={event.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CoralGradient preset="thumb" />
          )}
        </View>
        <View className="flex-1 items-start gap-1">
          <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-background py-[5px] pl-2 pr-2.5">
            <View className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />
            <Text className="font-inter-semibold text-tag text-text-primary">{label}</Text>
          </View>
          <Text className="font-inter-medium text-body text-text-primary">{event.title}</Text>
          <Text className="font-inter text-caption text-text-secondary">{formatEventDate(event.startsAt)}</Text>
        </View>
      </View>

      {status === 'published' && (
        <View className="flex-row gap-2">
          <CardAction label="Редагувати" onPress={onEdit} />
          <CardAction label="Скасувати" onPress={onCancel} />
        </View>
      )}
      {status === 'draft' && (
        <View className="flex-row">
          <CardAction label="Продовжити" dark onPress={onEdit} />
        </View>
      )}
    </View>
  );
}

// О1.1 "03.1 Порожньо": "Створити подію" opens О2.
function EmptyEvents({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="items-center gap-3 rounded-[22px] bg-surface-card px-6 pb-7 pt-8">
      <View
        className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
        style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
      >
        <Icon name="empty-calendar" size={34} color={colors.text['on-dark']} />
      </View>
      <Text className="text-center font-inter-semibold text-h2 text-text-primary">Тут будуть твої події</Text>
      <Text className="text-center font-inter text-body text-text-secondary">
        Створи першу подію, і люди знайдуть її в каталозі.
      </Text>
      <Button label="Створити подію" size="sm" onPress={onCreate} />
    </View>
  );
}

export default function OrganizationEventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { organizationEmpty } = useSession();
  const ownEvents = useOwnEvents();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Kept after closing, so the title does not change while the sheet fades out.
  const [cancelName, setCancelName] = useState('');
  // The id of the event to cancel when it is a live one; a mock row only closes the sheet, as in the prototype.
  const [cancelId, setCancelId] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string>();
  useStatusBarStyle('light');

  const rows: Row[] = [
    ...ownEvents.map((event): Row => ({ status: event.status, live: true, event })),
    ...(organizationEmpty ? [] : mockOrganization.events.map((item): Row => ({ ...item, live: false }))),
  ];
  const published = rows.filter((row) => row.status === 'published').length;
  const drafts = rows.filter((row) => row.status === 'draft').length;
  const summary =
    rows.length === 0
      ? mockOrganization.emptySummary
      : `${published} опубліковано${drafts ? ` · ${drafts} ${plural(drafts, ['чернетка', 'чернетки', 'чернеток'])}` : ''}`;

  const openEditor = () => router.push('/organization/event');
  // A mock row opens by its id too: the API does not know it, so the editor says so instead of showing a new event.
  const editRow = (row: Row) => router.push({ pathname: '/organization/event', params: { id: row.event.id } });
  const closeSheet = () => {
    setSheetOpen(false);
    setCancelError(undefined);
  };

  // cancelEvent never rejects: a failure comes back as a result and is shown in the sheet.
  const confirmCancel = async () => {
    if (!cancelId) {
      closeSheet();
      return;
    }
    setCancelling(true);
    setCancelError(undefined);
    const result = await cancelEvent(cancelId);
    setCancelling(false);
    if (result.ok) {
      rememberOwnEvent(result.data);
      closeSheet();
    } else {
      setCancelError(eventFailure(result));
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface-background">
      <View
        className="gap-5 overflow-hidden px-5 pb-[52px]"
        style={{ paddingTop: Math.max(HEADER_TOP, insets.top + GAP_BELOW_STATUS_BAR), marginBottom: -LIST_OVERLAP }}
      >
        <View className="absolute inset-0">
          {/* The auth header's gradient: Figma's transform grows with the header height, as there. */}
          <CoralGradient preset="auth" />
        </View>

        <View className="flex-row items-center gap-3">
          <View className="size-12 items-center justify-center rounded-2xl bg-white">
            <Icon name="building" size={24} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={1} className="font-inter-semibold text-title text-text-on-dark">
              {mockOrganization.name}
            </Text>
            <Text className="font-inter text-caption text-text-on-dark-muted">Акаунт організації</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Редагувати"
            onPress={() => router.push('/organization/settings')}
            className="size-10 items-center justify-center rounded-[20px] bg-white/[0.16]"
          >
            <Icon name="gallery-edit" size={20} color={colors.text['on-dark']} />
          </Pressable>
        </View>

        <View className="flex-row items-end justify-between">
          <View className="gap-1">
            <Text accessibilityRole="header" className="font-inter-bold text-display text-text-on-dark">
              Мої події
            </Text>
            <Text className="font-inter text-body text-text-on-dark-muted">{summary}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Нова подія"
            onPress={openEditor}
            className="flex-row items-center gap-1.5 rounded-[20px] bg-brand-coral py-2.5 pl-3 pr-4"
          >
            <Text className="font-inter-semibold text-[18px] leading-6 text-text-on-dark">+</Text>
            <Text className="font-inter-semibold text-button-sm text-text-on-dark">Нова</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-3.5 px-5 pb-10">
        {rows.length === 0 && <EmptyEvents onCreate={openEditor} />}
        {rows.map((row) => (
          <EventRow
            key={row.event.id}
            item={row}
            onEdit={() => editRow(row)}
            onCancel={() => {
              setCancelName(row.event.shortTitle ?? row.event.title);
              setCancelId(row.live ? row.event.id : undefined);
              setCancelError(undefined);
              setSheetOpen(true);
            }}
          />
        ))}
      </View>

      <CancelEventSheet
        visible={sheetOpen}
        eventName={cancelName}
        onClose={closeSheet}
        // The promise comes from `confirmCancel`, which shows its own failures.
        onConfirm={() => void confirmCancel()}
        loading={cancelling}
        error={cancelError}
      />
    </ScrollView>
  );
}
