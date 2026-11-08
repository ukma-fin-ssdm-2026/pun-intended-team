// Written with the help of Claude
// AI Usage: company search screen from the Figma "04 Пошук компанії" frame, on the user's application; reviewed by
// Daryna Halytska.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { withdrawApplication } from '@/api/applications';
import { failureSnackbar } from '@/auth/messages';
import { MatchingNav } from '@/components/matching/matching-nav';
import { LeavePoolDialog, SearchMenuSheet } from '@/components/matching/search-menu';
import { SearchRadar } from '@/components/matching/search-radar';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon, type IconName } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { formatEventDate, formatShortDay, formatUntil } from '@/dates';
import { useEventApplication } from '@/hooks/use-applications';
import { useEvent } from '@/hooks/use-event';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { plural } from '@/plural';
import { matchingPhase } from '@/state/applications';
import { colors } from '@/styles/tokens';

const HOUR_MS = 60 * 60 * 1000;
// How long before the session each round runs, as in the API (matching.md, policy).
const ROUND_OFFSETS_MS = [7 * 24 * HOUR_MS, 3 * 24 * HOUR_MS, 24 * HOUR_MS, 6 * HOUR_MS];

// The number of the next round among its day's rounds, from 1; one past the last when no round is left.
function roundNumber(sessions: { startsAt: string }[], nextRoundAt: string | null): number {
  if (!nextRoundAt) return ROUND_OFFSETS_MS.length + 1;
  const next = Date.parse(nextRoundAt);
  const day =
    sessions.find(({ startsAt }) => ROUND_OFFSETS_MS.some((offset) => Date.parse(startsAt) - offset === next)) ??
    sessions[0];
  const start = Date.parse(day?.startsAt ?? nextRoundAt);
  return ROUND_OFFSETS_MS.filter((offset) => start - offset < next).length + 1;
}

function WaitingItem({
  icon,
  title,
  note,
  onPress,
}: {
  icon: IconName;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center gap-3.5 py-3.5">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-card">
        <Icon name={icon} size={20} color={colors.brand.coral} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
        <Text className="font-inter text-caption text-text-secondary">{note}</Text>
      </View>
      <Icon name="arrow-right" size={18} color={colors.text.secondary} />
    </Pressable>
  );
}

export default function CompanySearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // "Ще" opens the 04.1 menu, whose "Вийти з підбору" opens the 04.2 dialog.
  const [overlay, setOverlay] = useState<'menu' | 'leave' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { snackbar, show } = useSnackbar();
  useStatusBarStyle('light');

  const { application, loaded } = useEventApplication(id);
  const { data: liveEvent } = useEvent(id);
  const mockEvent = findMockEvent(id);
  const event = liveEvent ?? mockEvent;
  const picked = application?.sessions ?? [];
  const day = picked[0]?.startsAt ?? event?.startsAt;
  const days =
    picked.length > 1
      ? `${picked.length} ${plural(picked.length, ['день', 'дні', 'днів'])}`
      : day && formatShortDay(day);
  const subtitle = event && days ? `${mockEvent?.shortTitle ?? event.title} · ${days}` : undefined;
  const backToEvent = () => router.dismissTo({ pathname: '/events/[id]', params: { id } });

  // Without an application for the event, e.g. after leaving the pool on another device, there is nothing to wait for.
  useEffect(() => {
    if (loaded && !application && !leaving) router.replace({ pathname: '/events/[id]', params: { id } });
  }, [loaded, application, leaving, router, id]);

  const nextRoundAt = application?.nextRoundAt ?? null;
  const phase = application ? matchingPhase(application) : 'rounds';
  const round = roundNumber(picked, nextRoundAt);
  const rounds = ROUND_OFFSETS_MS.length;
  const pick = {
    rounds: {
      label: 'Наступний підбір',
      value: nextRoundAt ? `${formatShortDay(nextRoundAt)} · ${formatUntil(nextRoundAt)}` : '',
      progress: `Підбір ${round} з ${rounds}`,
      note: 'останній за 6 год до події',
    },
    open: {
      label: 'Відкритий підбір',
      value: application ? `до ${formatEventDate(application.cutoffAt)}` : '',
      progress: `Усі ${rounds} підбори минули`,
      note: 'пару шукаємо одразу',
    },
    over: {
      label: 'Підбір',
      value: 'Підбір на цю подію завершено',
      progress: `Усі ${rounds} підбори минули`,
      note: '',
    },
  }[phase];

  // Leaves the pool on every picked day; a day that fails stays, and the snackbar says so.
  const leave = async () => {
    if (!application) return;
    setLeaving(true);
    const result = await withdrawApplication(application.id);
    if (result.ok) {
      setOverlay(null);
      backToEvent();
    } else {
      setLeaving(false);
      setOverlay(null);
      show(failureSnackbar(result));
    }
  };

  return (
    <ScrollView className="flex-1 bg-surface-card">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute left-0 right-0 top-0 h-[472px] overflow-hidden rounded-b-[28px]">
        <CoralGradient preset="search" />
      </View>

      <MatchingNav
        title="Пошук компанії"
        subtitle={subtitle}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace({ pathname: '/events/[id]', params: { id } })
        }
        onMore={() => setOverlay('menu')}
      />

      <View className="items-center gap-5 px-5 pb-2 pt-9">
        <SearchRadar />
        <View className="items-center gap-2">
          <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-on-dark">
            Ти в грі!
          </Text>
          <Text className="text-center font-inter text-caption leading-5 text-text-on-dark-muted">
            Ми штурхнемо тебе, щойно знайдемо людину зі схожими інтересами.
          </Text>
        </View>
      </View>

      <View className="px-5 pt-10">
        <View className="gap-3.5 rounded-[20px] bg-surface-background p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-11 items-center justify-center rounded-[14px] bg-surface-card">
              <Icon name="clock" size={22} color={colors.brand.coral} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-inter text-caption text-text-secondary">{pick.label}</Text>
              <Text className="font-inter-medium text-body text-text-primary">{pick.value}</Text>
            </View>
          </View>
          <View className="gap-2">
            <View className="flex-row gap-1.5">
              {Array.from({ length: rounds }, (_, index) => {
                const number = index + 1;
                const color =
                  number < round ? 'bg-brand-ink' : number === round ? 'bg-brand-coral' : 'bg-border-default';
                return <View key={number} className={`h-1.5 flex-1 rounded-[3px] ${color}`} />;
              })}
            </View>
            <View className="flex-row justify-between">
              <Text className="font-inter text-caption text-text-primary">{pick.progress}</Text>
              <Text className="font-inter text-caption text-text-secondary">{pick.note}</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="gap-3 px-5 pb-8 pt-6">
        <Text className="font-inter-semibold text-title text-text-primary">Поки чекаєш</Text>
        <View className="rounded-[20px] bg-surface-background px-4 py-1">
          <WaitingItem
            icon="calendar"
            title="Обрати іншу подію"
            note="Ти точно ще багато де не був(-ла)"
            onPress={() => router.dismissTo('/')}
          />
          <View className="h-px bg-border-default" />
          <WaitingItem
            icon="list"
            title="Створити оголошення"
            note="Запропонуй свою ідею для зустрічі"
            onPress={() => router.navigate({ pathname: '/announcements', params: { compose: '1' } })}
          />
        </View>
      </View>

      <SearchMenuSheet
        visible={overlay === 'menu'}
        onClose={() => setOverlay(null)}
        onChangeRequest={() => {
          setOverlay(null);
          router.dismissTo({ pathname: '/events/[id]', params: { id, request: '1' } });
        }}
        onLeave={() => setOverlay('leave')}
      />
      <LeavePoolDialog
        visible={overlay === 'leave'}
        onClose={() => setOverlay('menu')}
        leaving={leaving}
        onLeave={() => void leave()}
      />

      {snackbar && <Snackbar {...snackbar} />}
    </ScrollView>
  );
}
