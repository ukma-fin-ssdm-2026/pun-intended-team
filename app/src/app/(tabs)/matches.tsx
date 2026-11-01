// Written with the help of Claude
// AI Usage: Метчі tab from the Figma "Т2 Метчі", "Т2.1 · порожньо" and "Т2.2 · після прийняття" frames, on mock data;
// reviewed by Daryna Halytska.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { Snackbar } from '@/components/ui/snackbar';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent, type MockEvent } from '@/mocks/events';
import { mockMatchesTab, mockPeople, mockPerson, mockProposal, mockSearch } from '@/mocks/matching';
import { useMatches } from '@/state/matches';
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
  event: MockEvent;
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
          <Text className="font-inter text-caption text-text-secondary">{formatEventDate(event.startsAt)}</Text>
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

function Initial({ letter }: { letter: string }) {
  return (
    <View className="size-10 items-center justify-center rounded-[20px] bg-surface-card">
      <Text className="font-inter-semibold text-title text-text-secondary">{letter}</Text>
    </View>
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
  const { matchesEmpty } = useSession();
  const { answer } = useMatches();
  const answered = answer !== undefined;
  useStatusBarStyle('light');

  const proposalEvent = findMockEvent(mockSearch.eventId);
  const mutual = mockPeople.maksym;
  const mutualEvent = findMockEvent(mutual.eventId);
  const searchEvent = findMockEvent(mockMatchesTab.search.eventId);
  // The mutual card and "Написати" open 07; on Т2.2 the safety reminder (06) comes first, and "Зрозуміло" shows 07.
  const openMutual = () =>
    router.push({ pathname: '/mutual', params: answered ? { person: mutual.id, safety: '1' } : { person: mutual.id } });
  const tabBarSpace = BAR_HEIGHT + tabBarSafeArea(insets.bottom);
  const subtitle = matchesEmpty
    ? 'Тут з’являтимуться твої пропозиції'
    : answered
      ? mockMatchesTab.answeredSubtitle
      : mockMatchesTab.subtitle;

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

  if (matchesEmpty) {
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
          {proposalEvent && (
            <MatchCard
              event={proposalEvent}
              onPress={answered ? undefined : () => router.push('/proposal')}
              status={
                <>
                  <Initial letter={mockProposal.initial} />
                  <StatusText
                    title={mockProposal.nameAge}
                    note={answered ? `Чекаємо на ${mockPerson.accusative} і Марка` : 'Нова пропозиція · 3 спільні'}
                    coral
                  />
                  {answered ? (
                    <View className="size-9 items-center justify-center rounded-[18px] bg-text-secondary">
                      <Icon name="waiting-clock" size={18} color={colors.text['on-dark']} />
                    </View>
                  ) : (
                    <View className="size-9 items-center justify-center rounded-[18px] bg-brand-ink">
                      <Icon name="arrow-long" size={18} color={colors.text['on-dark']} />
                    </View>
                  )}
                </>
              }
            />
          )}
          {mutualEvent && (
            <MatchCard
              event={mutualEvent}
              onPress={openMutual}
              status={
                <>
                  <Initial letter={mutual.initial} />
                  <StatusText title={mutual.nameAge} note="Це взаємно · контакти відкрито" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Написати"
                    onPress={openMutual}
                    className="size-9 items-center justify-center rounded-[18px] bg-surface-card"
                  >
                    <Icon name="send" size={18} color={colors.brand.coral} />
                  </Pressable>
                </>
              }
            />
          )}
          {searchEvent && (
            <MatchCard
              event={searchEvent}
              onPress={() => router.push({ pathname: '/events/[id]/search', params: { id: searchEvent.id } })}
              status={
                <>
                  <View className="size-10 items-center justify-center rounded-[20px] bg-surface-card">
                    <Icon name="clock" size={20} />
                  </View>
                  <StatusText title="Шукаємо компанію" note={mockMatchesTab.search.nextPick} />
                </>
              }
            />
          )}
        </View>
      </ScrollView>

      {answer && <Snackbar title={mockMatchesTab.toast[answer].title} note={mockMatchesTab.toast[answer].note} />}
    </View>
  );
}
