// Written with the help of Claude
// AI Usage: event catalog from the Figma "01 Каталог подій", "01.1 · завантаження" and "01.2 · гість" screens, on mock
// data; reviewed by Daryna Halytska.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatalogHeader } from '@/components/catalog-header';
import { FiltersSheet } from '@/components/filters-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { EventCard } from '@/components/ui/event-card';
import { coverOf } from '@/components/ui/event-cover';
import { EventCardSkeleton } from '@/components/ui/event-card-skeleton';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SearchField } from '@/components/ui/search-field';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useCategories } from '@/hooks/use-categories';
import { useEvents } from '@/hooks/use-events';
import { useLastUpdatedNotice } from '@/hooks/use-events-freshness';
import { useProfile } from '@/hooks/use-profile';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockUser } from '@/mocks/user';
import {
  eventQuery,
  filterEvents,
  resetFilters,
  selectCategory,
  setQuery,
  useCatalogFilters,
} from '@/state/catalog-filters';
import { toggleFavorite, useFavoriteIds } from '@/state/favorites';
import { finishCatalogLoading, openGuestDialog, useSession } from '@/state/session';
import { colors } from '@/styles/tokens';

// The catalog row fits "Усі" and two categories at the 390 px Figma width, one on narrower screens (down to 320 px);
// the arrow after them opens the full list in the filters.
const visibleCategories = (screenWidth: number) => (screenWidth >= 375 ? 2 : 1);
// "03 Список подій" has a 120 px bottom padding: the 72 px bar, its 12 px safe area and 36 px above the bar.
const LIST_BOTTOM_GAP = 36;
// The prototype moves from the skeleton (01.1) to the catalog after 1.5 s, with a 0.25 s dissolve.
const LOADING_MS = 1500;
const DISSOLVE_MS = 250;
const SKELETON_COUNT = 2;
// The next page is requested this far (px) before the end of the list.
const NEXT_PAGE_DISTANCE = 400;

// The 01.3 card, also used when the catalog is empty or cannot be loaded.
function CatalogNotice({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-3 overflow-hidden rounded-[22px] bg-surface-card px-6 pb-7 pt-8">
      <View
        className="size-[76px] items-center justify-center rounded-[38px] bg-brand-coral"
        style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
      >
        <Icon name={icon} size={34} color={colors.text['on-dark']} />
      </View>
      <Text className="text-center font-inter-semibold text-h2 text-text-primary">{title}</Text>
      <Text className="text-center font-inter text-body text-text-secondary">{text}</Text>
      {action && <Button label={action.label} size="sm" onPress={action.onPress} />}
    </View>
  );
}

export default function CatalogScreen() {
  const router = useRouter();
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isGuest, catalogLoading } = useSession();
  const filters = useCatalogFilters();
  const favoriteIds = useFavoriteIds();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The API narrows by one category and by the days; the next page is loaded when the list is scrolled to its end.
  const allEvents = useEvents(eventQuery(filters));
  const categories = useCategories();
  const lastUpdated = useLastUpdatedNotice();
  useStatusBarStyle('light');

  // The timer runs only while the catalog is on screen, so the skeleton is seen even after switching modes elsewhere.
  useFocusEffect(
    useCallback(() => {
      if (!catalogLoading) return;
      const timer = setTimeout(finishCatalogLoading, LOADING_MS);
      return () => clearTimeout(timer);
    }, [catalogLoading]),
  );

  // The development switch can hold the skeleton longer than the request takes.
  const loading = catalogLoading || allEvents.loading;
  const categoryList = categories.data ?? [];
  const chips = [{ id: undefined, name: 'Усі' }, ...categoryList.slice(0, visibleCategories(width))];
  const isChipSelected = (id: string | undefined) =>
    id ? filters.categoryIds.includes(id) : filters.categoryIds.length === 0;
  const loadedEvents = allEvents.data ?? [];
  // Gap: the search text, several categories and "Де" filter only the pages loaded so far (catalog-access.md: no bulk
  // access, so the app does not load the whole catalog to search it).
  const events = filterEvents(loadedEvents, filters);

  const retry = () => {
    allEvents.reload();
    if (categories.error) categories.reload();
  };

  // A guest also opens the event page; it shows the sign-in dialog over it (02.2).
  const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  return (
    <>
      <ScrollView
        className="flex-1 bg-surface-background"
        contentContainerStyle={{ paddingBottom: BAR_HEIGHT + tabBarSafeArea(insets.bottom) + LIST_BOTTOM_GAP }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={200}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - NEXT_PAGE_DISTANCE) {
            allEvents.loadMore();
          }
        }}
      >
        {/* Taller than the header, so the first card starts over the gradient, as in Figma. */}
        <View className="absolute left-0 right-0 top-0 h-[484px]">
          <CoralGradient preset="header" />
        </View>

        {isGuest ? (
          <CatalogHeader onAvatarPress={openGuestDialog} />
        ) : (
          <CatalogHeader
            name={profile.data?.displayName}
            // Figma hides the unread dot while the catalog loads.
            hasUnread={mockUser.hasUnreadNotifications && !loading}
            onNotificationsPress={() => router.push('/notifications')}
            onAvatarPress={() => router.navigate('/profile')}
          />
        )}

        <View className="gap-4 px-5 pt-6">
          <SearchField value={filters.query} onChangeText={setQuery} returnKeyType="search" />
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

        {loading ? (
          <View className="gap-4 px-5 pt-7">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </View>
        ) : (
          // NativeWind maps className only on React Native's own components, so the layout sits on a View inside.
          <Animated.View entering={FadeIn.duration(DISSOLVE_MS)}>
            <View className="gap-4 px-5 pt-7">
              {lastUpdated && loadedEvents.length > 0 && (
                // FR-014: an import failed, so the imported events are those of its last succeeded run.
                <View className="flex-row items-center gap-2 self-start rounded-full bg-surface-card px-4 py-2">
                  <Icon name="clock" size={16} />
                  <Text className="font-inter text-caption text-text-secondary">{lastUpdated}</Text>
                </View>
              )}
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  title={event.title}
                  category={event.category.name}
                  dateLabel={formatEventDate(event.startsAt)}
                  place={event.venue.name}
                  cover={coverOf(event.imageUrl)}
                  favorite={favoriteIds.includes(event.id)}
                  onToggleFavorite={() => toggleFavorite(event.id)}
                  // The button opens the event page too, as in the prototype; the request starts there.
                  onPress={() => openEvent(event.id)}
                />
              ))}
              {allEvents.error ? (
                <CatalogNotice
                  icon="state-danger"
                  title="Не вдалося завантажити події"
                  text="Перевір зʼєднання з інтернетом і спробуй ще раз."
                  action={{ label: 'Спробувати ще раз', onPress: retry }}
                />
              ) : loadedEvents.length === 0 ? (
                <CatalogNotice
                  icon="empty-search"
                  title="Поки немає подій"
                  text="Нові події зʼявляються щодня. Зазирни трохи пізніше."
                />
              ) : (
                events.length === 0 && (
                  // 01.3: nothing matches the search or the filters.
                  <CatalogNotice
                    icon="empty-search"
                    title="Нічого не знайшли"
                    text="Спробуй змінити фільтри або дати. Нові події зʼявляються щодня."
                    action={{
                      label: 'Скинути фільтри',
                      onPress: () => {
                        setQuery('');
                        resetFilters();
                      },
                    }}
                  />
                )
              )}
              {allEvents.loadingMore && <ActivityIndicator color={colors.brand.coral} />}
              {allEvents.hasMore && !allEvents.loadingMore && !allEvents.error && (
                // Also for a list too short to scroll, e.g. when the search hides most of the loaded events.
                <Button
                  label={allEvents.loadMoreFailed ? 'Не вдалося завантажити. Спробувати ще раз' : 'Показати ще'}
                  variant="light"
                  onPress={allEvents.loadMore}
                />
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <FiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        events={loadedEvents}
        categories={categoryList}
      />
    </>
  );
}
