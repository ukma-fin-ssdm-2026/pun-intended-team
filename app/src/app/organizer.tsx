// Written with the help of Claude
// AI Usage: organizer page from the Figma "Сторінка організатора" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '@/components/ui/event-card';
import { Icon } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockOrganizer } from '@/mocks/organization';
import { toggleFavorite, useFavoriteIds } from '@/state/favorites';
import { colors } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar); "02 Організатор" has a 40 px bottom
// padding.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CONTENT_BOTTOM = 40;

export default function OrganizerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const favoriteIds = useFavoriteIds();
  useStatusBarStyle('dark');

  const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  return (
    <View className="flex-1 bg-surface-card">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-row items-center justify-between px-5 pb-4"
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
        <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-primary">
          Організатор
        </Text>
        <View className="size-10" />
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2"
        contentContainerStyle={{ paddingBottom: Math.max(CONTENT_BOTTOM, insets.bottom) }}
      >
        <View className="flex-row items-center gap-3.5">
          <View className="size-[72px] items-center justify-center rounded-[36px] bg-brand-coral-soft">
            <Icon name="building" size={32} color={colors.brand.coral} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-inter-bold text-h1 text-text-primary">{mockOrganizer.name}</Text>
            <Text className="font-inter text-caption text-text-secondary">{mockOrganizer.kind}</Text>
          </View>
        </View>

        <Text className="font-inter text-body text-text-secondary">{mockOrganizer.about}</Text>

        <View className="flex-row gap-2">
          {mockOrganizer.links.map((link) => (
            <Pressable
              key={link}
              accessibilityRole="link"
              className="rounded-[18px] bg-surface-background px-4 py-[9px]"
            >
              <Text className="font-inter-medium text-label text-text-primary">{link}</Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="font-inter-semibold text-title text-text-primary">Найближчі події</Text>
          <Text className="font-inter text-caption text-text-secondary">{mockOrganizer.eventsLabel}</Text>
        </View>

        {mockOrganizer.events.map((event) => (
          <EventCard
            key={event.id}
            title={event.title}
            category={event.category.name}
            dateLabel={formatEventDate(event.startsAt)}
            place={event.venue.name}
            cover={event.cover}
            favorite={favoriteIds.includes(event.id)}
            onToggleFavorite={() => toggleFavorite(event.id)}
            // The button opens the event page too, as on the catalog cards.
            onPress={() => openEvent(event.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
