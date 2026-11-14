// Written with the help of Claude
// AI Usage: Метчі tab from the Figma "Т2 Метчі" and "Т2.1 · порожньо" frames, on the user's applications and matches;
// reviewed by Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadMyApplications } from '@/api/applications';
import { loadMyMatches } from '@/api/matches';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate, formatShortDay } from '@/dates';
import { useMyApplications } from '@/hooks/use-applications';
import { useEvent } from '@/hooks/use-event';
import { useMyMatches } from '@/hooks/use-matches';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { plural } from '@/plural';
import { matchingPhase, openSessions, type Application } from '@/state/applications';
import { matchHref, type Match } from '@/state/matches';
import { useSession } from '@/state/session';
import { colors, shadows } from '@/styles/tokens';

// "01 Шапка": top padding 64 in the iPhone 14 frame (17 px below its status bar), 52 at the bottom, of which the list
// covers 28. The list keeps 120 px under it for the tab bar (72 + 22 + 26).
const HEADER_TOP = 64;
const GAP_BELOW_STATUS_BAR = 17;
const LIST_OVERLAP = 28;
const LIST_BOTTOM_GAP = 26;

function MatchCard({
  event,
  status,
  onPress,
}: {
  event: { title: string; dateLabel: string; cover?: ImageSource | number };
  status: ReactNode;
  // Without a link (Т2.2's first card) the card is not pressable.
  onPress?: () => void;
}) {
  const content = (
    <>
      <View className="flex-row items-center gap-3">
        <View className="size-10 overflow-hidden rounded-xl">
          {event.cover ? (
            <Image source={event.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CoralGradient preset="thumb" />
          )}
        </View>
        <View className="flex-1 gap-px">
          <Text numberOfLines={1} className="font-inter-medium text-label text-text-primary">
            {event.title}
          </Text>
          <Text className="font-inter text-caption text-text-secondary">{event.dateLabel}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3 rounded-[18px] bg-surface-background py-2.5 pl-2.5 pr-3">
        {status}
      </View>
    </>
  );
  const className = 'gap-3 rounded-[24px] bg-surface-card p-3.5';
  const style = { boxShadow: shadows.small };
  return onPress ? (
    <Pressable accessibilityRole="link" onPress={onPress} className={className} style={style}>
      {content}
    </Pressable>
  ) : (
    <View className={className} style={style}>
      {content}
    </View>
  );
}

function StatusText({ title, note, coral = false }: { title: string; note: string; coral?: boolean }) {
  return (
    <View className="flex-1 gap-px">
      <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
      <Text className={`font-inter text-caption ${coral ? 'text-brand-coral' : 'text-text-secondary'}`}>{note}</Text>
    </View>
  );
}

function statusNote(application: Application): string {
  if (application.status === 'paused') return 'Підбір на паузі';
  if (application.status === 'paired') return 'Є пропозиція';
  const phase = matchingPhase(application);
  if (phase === 'rounds' && application.nextRoundAt) {
    return `Наступний підбір: ${formatShortDay(application.nextRoundAt)}`;
  }
  return phase === 'open' ? `Відкритий підбір до ${formatEventDate(application.cutoffAt)}` : 'Підбір завершено';
}

// "Сб, 24 жовт · 19:00", or the first picked day of a multi-day event and how many more.
function daysLabel(sessions: Application['sessions']): string {
  const first = sessions[0]?.startsAt ?? '';
  const more = sessions.length - 1;
  return more > 0
    ? `${formatShortDay(first)} і ще ${more} ${plural(more, ['день', 'дні', 'днів'])}`
    : formatEventDate(first);
}

// The card of one application, with the days it waits on.
function SearchCard({ application }: { application: Application }) {
  const router = useRouter();
  const { data: event } = useEvent(application.eventId);
  return (
    <MatchCard
      event={{
        title: event?.title ?? ' ',
        dateLabel: daysLabel(openSessions(application)),
        cover: findMockEvent(application.eventId)?.cover,
      }}
      onPress={() => router.push({ pathname: '/events/[id]/search', params: { id: application.eventId } })}
      status={
        <>
          <View className="size-10 items-center justify-center rounded-[20px] bg-surface-card">
            <Icon name="clock" size={20} />
          </View>
          <StatusText title="Шукаємо компанію" note={statusNote(application)} />
        </>
      }
    />
  );
}

const matchStatus: Record<Match['status'], { title: string; note: (match: Match) => string; coral?: boolean }> = {
  proposed: {
    title: 'Є пропозиція',
    note: (match) => `${match.partner.displayName} · встигни відповісти до ${formatEventDate(match.validUntil)}`,
    coral: true,
  },
  accepted: { title: 'Згоду надіслано', note: (match) => `${match.partner.displayName} ще думає` },
  mutual: { title: 'Це взаємно!', note: () => 'Контакти відкрито', coral: true },
  expired: { title: 'Час вийшов', note: () => 'Пропозиція вже не діє' },
  declined: { title: 'Не цього разу', note: () => 'Шукаємо далі' },
  cancelled: { title: 'Пропозицію скасовано', note: () => 'Шукаємо далі' },
};

// The card of an application with a match: a proposal, an answer that waits for the other, or a mutual match.
function MatchedCard({ application, match }: { application: Application; match: Match }) {
  const router = useRouter();
  const { data: event } = useEvent(application.eventId);
  const status = matchStatus[match.status];
  const day = match.days[0]?.startsAt;
  return (
    <MatchCard
      event={{
        title: event?.title ?? ' ',
        dateLabel: match.days.length > 1 ? daysLabel(match.days) : day ? formatEventDate(day) : '',
        cover: findMockEvent(application.eventId)?.cover,
      }}
      onPress={match.status === 'expired' ? undefined : () => router.push(matchHref(match))}
      status={
        <>
          <View className="size-10 items-center justify-center rounded-[20px] bg-surface-card">
            <Text className="font-inter-bold text-title text-text-secondary">
              {match.partner.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <StatusText title={status.title} note={status.note(match)} coral={status.coral} />
        </>
      }
    />
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-5" style={{ paddingBottom: 120 }}>
      <View className="w-full items-center gap-3.5 px-8">
        <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14] bg-surface-background">
          <View
            className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
            style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
          >
            <Icon name="empty-matches" size={34} color={colors.text['on-dark']} />
          </View>
        </View>
        <Text className="text-center font-inter-bold text-h1 text-text-primary">Поки без метчів</Text>
        <Text className="text-center font-inter text-body text-text-secondary">
          Обери подію в каталозі й натисни «Знайти мені метч». Ми підберемо тобі компанію за інтересами.
        </Text>
        <View className="h-1.5" />
        <View className="w-full">
          <Button label="Обрати подію" variant="dark" onPress={onPick} />
        </View>
      </View>
    </View>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applications, loading, error, reload } = useMyApplications();
  const { matches } = useMyMatches();
  const { signedIn, isGuest } = useSession();
  const enabled = signedIn && !isGuest;
  useStatusBarStyle('light');
  // A round may have proposed a match since the tab was last open; the loads share a request already in flight.
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void loadMyApplications();
      void loadMyMatches();
    }, [enabled]),
  );

  const tabBarSpace = BAR_HEIGHT + tabBarSafeArea(insets.bottom);
  const count = applications.length;
  const subtitle =
    count > 0 ? `${count} ${plural(count, ['подія', 'події', 'подій'])}` : 'Тут з’являтимуться твої пропозиції';

  const header = (
    <View
      className="gap-1.5 overflow-hidden px-5 pb-[52px]"
      style={{ paddingTop: Math.max(HEADER_TOP, insets.top + GAP_BELOW_STATUS_BAR), marginBottom: -LIST_OVERLAP }}
    >
      <View className="absolute inset-0">
        <CoralGradient preset="tabHeader" />
      </View>
      <Text accessibilityRole="header" className="font-inter-bold text-display text-text-on-dark">
        Метчі
      </Text>
      <Text className="font-inter text-body text-text-on-dark-muted">{subtitle}</Text>
    </View>
  );

  if (count === 0 && (loading || error)) {
    return (
      <View className="flex-1 bg-surface-background">
        {header}
        <View className="flex-1 items-center justify-center gap-4 px-5" style={{ paddingBottom: tabBarSpace }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.brand.coral} />
          ) : (
            <>
              <Text className="text-center font-inter-semibold text-title text-text-primary">
                Не вдалося завантажити метчі
              </Text>
              <Button label="Спробувати ще раз" variant="dark" onPress={reload} />
            </>
          )}
        </View>
      </View>
    );
  }

  if (count === 0) {
    return (
      <View className="flex-1 bg-surface-background">
        {header}
        <EmptyState onPick={() => router.navigate('/')} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-background">
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarSpace + LIST_BOTTOM_GAP }}>
        {header}
        <View className="gap-3.5 px-5">
          {applications.map((application) => {
            const match = matches.find(({ applicationId }) => applicationId === application.id);
            return match ? (
              <MatchedCard key={application.id} application={application} match={match} />
            ) : (
              <SearchCard key={application.id} application={application} />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
