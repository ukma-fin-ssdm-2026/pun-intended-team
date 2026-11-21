// Written with the help of Claude
// AI Usage: organization events page from the Figma "DО1 Організація · Мої події" desktop frame, with DО1.1 and the DО3
// dialog; the card follows О1.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { cancelEvent, type Event } from '@/api/events';
import { getMyOrganization } from '@/api/organizations';
import { CancelEventDialog } from '@/components/organization/cancel-event-dialog';
import { eventFailure } from '@/components/organization/event-messages';
import { ApiPicture } from '@/components/pictures/picture';
import { Button } from '@/components/ui/button';
import { CoralGradient, type GradientFrame } from '@/components/ui/coral-gradient';
import { EventCover, eventCoverOf } from '@/components/ui/event-cover';
import { Icon } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';
import { useMyEvents } from '@/hooks/use-my-events';
import { colors, shadows } from '@/styles/tokens';

// "01 Шапка" of DО1: 1440 × 216.
const HEADER_GRADIENT: GradientFrame = {
  width: 1440,
  height: 216,
  transform: 'matrix(171.69 34.201 -153.75 38.305 39.888 -15.854)',
};
// "Сітка подій": three cards in the 1200 px column, 24 px apart; fewer in a narrower window.
const CONTENT_MAX = 1200;
const SIDE_PADDING = 40;
const GRID_GAP = 24;
const MIN_CARD_WIDTH = 340;

// The API has no drafts, so Figma's "Чернетка" status and its "Продовжити" button are not shown.
const statuses: Record<Event['status'], { label: string; dot: string }> = {
  // The green of the "Опубліковано" dot is not a Figma variable.
  published: { label: 'Опубліковано', dot: '#22C55E' },
  cancelled: { label: 'Скасовано', dot: colors.brand.coral },
};

function CardAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 items-center rounded-2xl bg-surface-background py-2.5 hover:bg-border-default"
    >
      <Text className="font-inter-medium text-label text-text-primary">{label}</Text>
    </Pressable>
  );
}

function EventCard({ event, onEdit, onCancel }: { event: Event; onEdit: () => void; onCancel: () => void }) {
  const { status } = event;
  const { label, dot } = statuses[status];

  return (
    <View className="flex-1 gap-3 rounded-[24px] bg-surface-card p-3" style={{ boxShadow: shadows.small }}>
      <View className="flex-row items-center gap-3">
        <View className={`size-[94px] overflow-hidden rounded-2xl ${status === 'cancelled' ? 'opacity-50' : ''}`}>
          <EventCover cover={eventCoverOf(event)} photo={event.photo} gradient="thumb" />
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
    </View>
  );
}

// DО1.1: "Створити подію" opens DО2.
function EmptyEvents({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="w-full max-w-[560px] items-center gap-3 self-center rounded-[22px] bg-surface-card px-6 pb-7 pt-8">
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

/** The events in rows of `columns`; a short last row keeps the cards' width with empty places. */
function rowsOf<T>(items: T[], columns: number): (T | undefined)[][] {
  const rows: (T | undefined)[][] = [];
  for (let start = 0; start < items.length; start += columns) {
    const row: (T | undefined)[] = items.slice(start, start + columns);
    while (row.length < columns) row.push(undefined);
    rows.push(row);
  }
  return rows;
}

export default function OrganizationEventsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const events = useMyEvents();
  const organization = useApiQuery('my-organization', getMyOrganization);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Kept after closing, so the title does not change while the dialog fades out.
  const [cancelName, setCancelName] = useState('');
  const [cancelId, setCancelId] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string>();

  // The editor returns here after a save, so the list is loaded again each time the page is shown.
  const { reload } = events;
  useFocusEffect(useCallback(() => reload(), [reload]));

  const contentWidth = Math.min(CONTENT_MAX, width - 2 * SIDE_PADDING);
  const columns = Math.max(1, Math.min(3, Math.floor((contentWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP))));

  const list = events.data ?? [];
  const published = list.filter((event) => event.status === 'published').length;
  const cancelled = list.length - published;
  const summary = !events.data
    ? ''
    : list.length === 0
      ? 'Поки що жодної події'
      : `${published} опубліковано${cancelled ? ` · ${cancelled} скасовано` : ''}`;

  const openEditor = () => router.push('/organization/event');
  const editEvent = (event: Event) => router.push({ pathname: '/organization/event', params: { id: event.id } });
  const closeDialog = () => {
    setDialogOpen(false);
    setCancelError(undefined);
  };

  // cancelEvent never rejects: a failure comes back as a result and is shown in the dialog.
  const confirmCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    setCancelError(undefined);
    const result = await cancelEvent(cancelId);
    setCancelling(false);
    if (result.ok) {
      events.setData(list.map((event) => (event.id === result.data.id ? result.data : event)));
      closeDialog();
    } else {
      setCancelError(eventFailure(result));
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface-background">
      <View className="overflow-hidden py-10" style={{ paddingHorizontal: SIDE_PADDING }}>
        <View className="absolute inset-0">
          <CoralGradient frame={HEADER_GRADIENT} />
        </View>

        <View className="w-full max-w-[1200px] gap-7 self-center">
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center overflow-hidden rounded-2xl bg-white">
              {organization.data?.logo ? (
                <ApiPicture image={organization.data.logo} />
              ) : (
                <Icon name="building" size={24} />
              )}
            </View>
            <View className="flex-1 gap-0.5">
              <Text numberOfLines={1} className="font-inter-semibold text-title text-text-on-dark">
                {organization.data?.name}
              </Text>
              <Text className="font-inter text-caption text-text-on-dark-muted">Акаунт організації</Text>
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Налаштування організації"
              onPress={() => router.push('/organization/settings')}
              className="size-10 items-center justify-center rounded-[20px] bg-white/[0.16] hover:bg-white/[0.24]"
            >
              <Icon name="gallery-edit" size={20} color={colors.text['on-dark']} />
            </Pressable>
          </View>

          <View className="flex-row items-end justify-between">
            <View className="gap-1">
              <Text accessibilityRole="header" className="font-inter-bold text-display text-text-on-dark">
                Мої події
              </Text>
              {/* A space while the events load keeps the header at its height. */}
              <Text className="font-inter text-body text-text-on-dark-muted">{summary || '\u00a0'}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Нова подія"
              onPress={openEditor}
              className="flex-row items-center gap-1.5 rounded-full bg-brand-coral py-2.5 pl-3 pr-4 hover:bg-brand-coral-dark"
            >
              <Text className="font-inter-semibold text-[18px] leading-6 text-text-on-dark">+</Text>
              <Text className="font-inter-semibold text-button-sm text-text-on-dark">Нова</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View className="pb-20 pt-8" style={{ paddingHorizontal: SIDE_PADDING }}>
        <View className="w-full max-w-[1200px] self-center" style={{ gap: GRID_GAP }}>
          {!events.data && events.loading && (
            <View className="min-h-40 items-center justify-center">
              <ActivityIndicator size="large" color={colors.brand.coral} />
            </View>
          )}
          {!events.data && !events.loading && events.error && (
            <View className="w-full max-w-[560px] items-center gap-3 self-center rounded-[22px] bg-surface-card px-6 py-8">
              <Text className="text-center font-inter text-body text-text-secondary">Не вдалося завантажити події</Text>
              <Button label="Спробувати ще раз" size="sm" onPress={events.reload} />
            </View>
          )}
          {events.data && list.length === 0 && <EmptyEvents onCreate={openEditor} />}
          {rowsOf(list, columns).map((row) => (
            <View key={row.map((event) => event?.id).join()} className="flex-row" style={{ gap: GRID_GAP }}>
              {row.map((event, index) =>
                event ? (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={() => editEvent(event)}
                    onCancel={() => {
                      setCancelName(event.title);
                      setCancelId(event.id);
                      setCancelError(undefined);
                      setDialogOpen(true);
                    }}
                  />
                ) : (
                  <View key={`empty-${index}`} className="flex-1" />
                ),
              )}
            </View>
          ))}
        </View>
      </View>

      <CancelEventDialog
        visible={dialogOpen}
        eventName={cancelName}
        onClose={closeDialog}
        // The promise comes from `confirmCancel`, which shows its own failures.
        onConfirm={() => void confirmCancel()}
        loading={cancelling}
        error={cancelError}
      />
    </ScrollView>
  );
}
