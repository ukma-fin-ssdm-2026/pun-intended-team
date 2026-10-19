// Written with the help of Claude
// AI Usage: event catalog from the Figma "01 Каталог подій", "01.1 · завантаження" and "01.2 · гість" screens, on mock
// data; reviewed by Daryna Halytska.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatalogHeader } from '@/components/catalog-header';
import { FiltersSheet } from '@/components/filters-sheet';
import { Chip } from '@/components/ui/chip';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { EventCard } from '@/components/ui/event-card';
import { EventCardSkeleton } from '@/components/ui/event-card-skeleton';
import { IconButton } from '@/components/ui/icon-button';
import { SearchField } from '@/components/ui/search-field';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockCategories, mockEvents } from '@/mocks/events';
import { mockUser } from '@/mocks/user';
import { filterEvents, selectCategory, setQuery, useCatalogFilters } from '@/state/catalog-filters';
import { finishCatalogLoading, useSession } from '@/state/session';

// The catalog row fits "Усі" and two categories at the 390 px Figma width, one on narrower screens (down to 320 px);
// the arrow after them opens the full list in the filters.
const visibleCategories = (screenWidth: number) => (screenWidth >= 375 ? 2 : 1);
// "03 Список подій" has a 120 px bottom padding: the 72 px bar, its 22 px safe area and 26 px above the bar.
const LIST_BOTTOM_GAP = 26;
// The prototype moves from the skeleton (01.1) to the catalog after 1.5 s, with a 0.25 s dissolve.
const LOADING_MS = 1500;
const DISSOLVE_MS = 250;
const SKELETON_COUNT = 2;

export default function CatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isGuest, catalogLoading } = useSession();
  const filters = useCatalogFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  useStatusBarStyle('light');

  // The timer runs only while the catalog is on screen, so the skeleton is seen even after switching modes elsewhere.
  useFocusEffect(
    useCallback(() => {
      if (!catalogLoading) return;
      const timer = setTimeout(finishCatalogLoading, LOADING_MS);
      return () => clearTimeout(timer);
    }, [catalogLoading]),
  );

  const chips = [{ id: undefined, name: 'Усі' }, ...mockCategories.slice(0, visibleCategories(width))];
  const isChipSelected = (id: string | undefined) =>
    id ? filters.categoryIds.includes(id) : filters.categoryIds.length === 0;
  const events = filterEvents(mockEvents, filters);

  // A guest also opens the event page; it shows the sign-in dialog over it (02.2).
  const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  return (
    <>
      <ScrollView
        className="flex-1 bg-surface-background"
        contentContainerStyle={{ paddingBottom: BAR_HEIGHT + tabBarSafeArea(insets.bottom) + LIST_BOTTOM_GAP }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Taller than the header, so the first card starts over the gradient, as in Figma. */}
        <View className="absolute left-0 right-0 top-0 h-[484px]">
          <CoralGradient preset="header" />
        </View>

        {isGuest ? (
          <CatalogHeader onAvatarPress={() => router.push('/sign-in')} />
        ) : (
          <CatalogHeader
            name={mockUser.firstNameVocative}
            // Figma hides the unread dot while the catalog loads.
            hasUnread={mockUser.hasUnreadNotifications && !catalogLoading}
            onNotificationsPress={() => router.push('/notifications')}
            onAvatarPress={() => router.navigate('/profile')}
          />
        )}

        <View className="gap-4 px-5 pt-6">
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <SearchField value={filters.query} onChangeText={setQuery} returnKeyType="search" />
            </View>
            <IconButton icon="filter" accessibilityLabel="Фільтри" onPress={() => setFiltersOpen(true)} />
          </View>
          <View className="flex-row items-center gap-2">
            {chips.map((chip) => (
              <View key={chip.id ?? 'all'} className="flex-1">
                <Chip label={chip.name} selected={isChipSelected(chip.id)} onPress={() => selectCategory(chip.id)} />
              </View>
            ))}
            <IconButton
              icon="arrow-right"
              variant="glass"
              accessibilityLabel="Усі категорії"
              onPress={() => setFiltersOpen(true)}
            />
          </View>
        </View>

        {catalogLoading ? (
          <View className="gap-4 px-5 pt-7">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </View>
        ) : (
          // NativeWind maps className only on React Native's own components, so the layout sits on a View inside.
          <Animated.View entering={FadeIn.duration(DISSOLVE_MS)}>
            <View className="gap-4 px-5 pt-7">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  title={event.title}
                  category={event.category.name}
                  dateLabel={formatEventDate(event.startsAt)}
                  place={event.venue.name}
                  cover={event.cover}
                  // The button opens the event page too, as in the prototype; the request starts there.
                  onPress={() => openEvent(event.id)}
                />
              ))}
              {events.length === 0 && (
                <Text className="py-10 text-center font-inter text-body text-text-secondary">Подій не знайшли</Text>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <FiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </>
  );
}
