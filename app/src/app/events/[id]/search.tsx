// Written with the help of Claude
// AI Usage: company search screen from the Figma "04 Пошук компанії" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MatchingNav } from '@/components/matching/matching-nav';
import { SearchRadar } from '@/components/matching/search-radar';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon, type IconName } from '@/components/ui/icon';
import { formatShortDay } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { mockSearch } from '@/mocks/matching';
import { colors } from '@/styles/tokens';

// The prototype shows the proposed match (05) after 4 s of searching.
const SEARCH_MS = 4000;

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
  useStatusBarStyle('light');

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => router.push('/proposal'), SEARCH_MS);
      return () => clearTimeout(timer);
    }, [router]),
  );

  const event = findMockEvent(id);
  const subtitle = event ? `${event.shortTitle ?? event.title} · ${formatShortDay(event.startsAt)}` : undefined;

  return (
    <ScrollView className="flex-1 bg-surface-card">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute left-0 right-0 top-0 h-[472px] overflow-hidden rounded-b-[28px]">
        <CoralGradient preset="search" />
      </View>

      <MatchingNav title="Пошук компанії" subtitle={subtitle} onBack={() => router.back()} />

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
              <Text className="font-inter text-caption text-text-secondary">Наступний підбір</Text>
              <Text className="font-inter-medium text-body text-text-primary">{mockSearch.nextPick}</Text>
            </View>
          </View>
          <View className="gap-2">
            <View className="flex-row gap-1.5">
              {Array.from({ length: mockSearch.rounds }, (_, index) => {
                const round = index + 1;
                const color =
                  round < mockSearch.round
                    ? 'bg-brand-ink'
                    : round === mockSearch.round
                      ? 'bg-brand-coral'
                      : 'bg-border-default';
                return <View key={round} className={`h-1.5 flex-1 rounded-[3px] ${color}`} />;
              })}
            </View>
            <View className="flex-row justify-between">
              <Text className="font-inter text-caption text-text-primary">
                Підбір {mockSearch.round} з {mockSearch.rounds}
              </Text>
              <Text className="font-inter text-caption text-text-secondary">{mockSearch.roundsNote}</Text>
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
            onPress={() => router.push('/new-announcement')}
          />
        </View>
      </View>
    </ScrollView>
  );
}
