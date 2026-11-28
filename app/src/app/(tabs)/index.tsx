// Written with the help of Claude
// AI Usage: event catalog from the Figma "01 Каталог подій", "01.1 · завантаження" and "01.2 · гість" screens, on mock
// data; reviewed by Daryna Halytska.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadNotifications } from '@/api/notifications';
import { CatalogHeader } from '@/components/catalog-header';
import { CardGrid } from '@/components/desktop/card-grid';
import { DesktopHeader } from '@/components/desktop/desktop-header';
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
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useProfile } from '@/hooks/use-profile';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import {
  eventQuery,
  filterEvents,
  hasFilters,
  resetFilters,
  selectCategory,
  setQuery,
  useCatalogFilters,
} from '@/state/catalog-filters';
import { toggleFavorite, useFavoriteIds } from '@/state/favorites';
import { unreadCount, useNotificationsState } from '@/state/notifications';
import { finishCatalogLoading, openGuestDialog, useSession } from '@/state/session';
import { colors, desktop } from '@/styles/tokens';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

// The catalog row fits "Усі" and two categories at the 390 px Figma width, one on narrower screens (down to 320 px);
// the arrow after them opens the full list in the filters.
const visibleCategories = (screenWidth: number) => (screenWidth >= 375 ? 2 : 1);
// "03 Список подій" has a 120 px bottom padding: the 72 px bar, its 12 px safe area and 36 px above the bar.
const LIST_BOTTOM_GAP = 36;
// The prototype moves from the skeleton (01.1) to the catalog after 1.5 s, with a 0.25 s dissolve.
const LOADING_MS = 1500;
const DISSOLVE_MS = 250;
const SKELETON_COUNT = 2;
// The desktop catalog shows the categories in one row under the search ("Категорії" of D01), and two rows of skeletons.
const DESKTOP_CATEGORIES = 8;
const DESKTOP_SKELETON_COUNT = 6;
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
  const isDesktop = useIsDesktop();
  const { isGuest, catalogLoading } = useSession();
  const filters = useCatalogFilters();
  const favoriteIds = useFavoriteIds();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The API narrows by the categories, the days and "Поруч зі мною"; the next page is loaded when the list is scrolled
  // to its end.
  const allEvents = useEvents(eventQuery(filters));
  const categories = useCategories();
  const lastUpdated = allEvents.lastUpdated;
  const inbox = useNotificationsState();
  const hasUnread = inbox.status === 'loaded' && unreadCount(inbox.notifications) > 0;
  useStatusBarStyle('light');

  // Read again each time the catalog shows, so the dot follows what came in and what was read on Т5.
  useFocusEffect(
    useCallback(() => {
      if (!isGuest) void loadNotifications();
    }, [isGuest]),
  );

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
  const chips = [
    { id: undefined, name: 'Усі' },
    ...categoryList.slice(0, isDesktop ? DESKTOP_CATEGORIES : visibleCategories(width)),
  ];
  const isChipSelected = (id: string | undefined) =>
    id ? filters.categoryIds.includes(id) : filters.categoryIds.length === 0;
  const loadedEvents = allEvents.data ?? [];
  // Gap: the search text filters only the pages loaded so far (catalog-access.md: no bulk access, so the app does not
  // load the whole catalog to search it).
  const events = filterEvents(loadedEvents, filters);

  const retry = () => {
    allEvents.reload();
    if (categories.error) categories.reload();
  };

  const renderCard = (event: (typeof events)[number]) => (
    <EventCard
      key={event.id}
      title={event.title}
      category={event.category.name}
      dateLabel={formatEventDate(event.startsAt, event.startTimeKnown)}
      place={event.venue.name}
      cover={coverOf(event.imageUrl)}
      photo={event.photo}
      favorite={favoriteIds.includes(event.id)}
      onToggleFavorite={() => toggleFavorite(event.id)}
      // The button opens the event page too, as in the prototype; the request starts there.
      onPress={() => openEvent(event.id)}
    />
  );

  // 01.3 and the states of an empty or failed catalog, in both layouts.
  const notice = allEvents.error ? (
    <CatalogNotice
      icon="state-danger"
      title="Не вдалося завантажити події"
      text="Перевір зʼєднання з інтернетом і спробуй ще раз."
      action={{ label: 'Спробувати ще раз', onPress: retry }}
    />
  ) : loadedEvents.length === 0 && !hasFilters(filters) ? (
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
        title="Нічого не знайдено за цими фільтрами"
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
  );

  // A guest also opens the event page; it shows the sign-in dialog over it (02.2).
  const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  const filtersSheet = (
    <FiltersSheet
      visible={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      events={loadedEvents}
      categories={categoryList}
    />
  );

  const loadMoreControls = (
    <>
      {allEvents.loadingMore && <ActivityIndicator color={colors.brand.coral} />}
      {allEvents.hasMore && !allEvents.loadingMore && !allEvents.error && (
        // Also for a list too short to scroll, e.g. when the search hides most of the loaded events.
        <Button
          label={allEvents.loadMoreFailed ? 'Не вдалося завантажити. Спробувати ще раз' : 'Показати ще'}
          variant="light"
          onPress={allEvents.loadMore}
        />
      )}
    </>
  );

  const onScroll = ({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }: ScrollEvent) => {
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - NEXT_PAGE_DISTANCE) {
      allEvents.loadMore();
    }
  };

  // D01 with its loading (567:6591), guest (567:6861) and nothing found (567:6992) states.
  if (isDesktop) {
    return (
      <>
        <ScrollView
          className="flex-1 bg-surface-background"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={200}
          onScroll={onScroll}
        >
          <View className="overflow-hidden pb-14">
            <CoralGradient preset="desktopHero" />
            <DesktopHeader active="events" transparent />
            <View className="items-center gap-7 px-[120px] pt-12">
              <Text
                accessibilityRole="header"
                className="w-[660px] max-w-full text-center font-inter-bold text-desktop-hero tracking-[-0.44px] text-text-on-dark"
              >
                Обери подію, а ми знайдемо тобі компанію
              </Text>
              <View className="w-[720px] max-w-full">
                <SearchField value={filters.query} onChangeText={setQuery} returnKeyType="search" />
              </View>
              <View className="flex-row flex-wrap items-center justify-center gap-2">
                {chips.map((chip) => (
                  <Chip
                    key={chip.id ?? 'all'}
                    label={chip.name}
                    selected={isChipSelected(chip.id)}
                    onPress={() => selectCategory(chip.id)}
                  />
                ))}
                <IconButton
                  icon="arrow-right"
                  variant="glass"
                  accessibilityLabel="Усі категорії"
                  onPress={() => setFiltersOpen(true)}
                />
              </View>
            </View>
          </View>

          <View className="w-full self-center px-[120px] pb-24 pt-12" style={{ maxWidth: desktop.contentWidth + 240 }}>
            <View className="gap-6">
              <View className="flex-row items-center justify-between">
                <Text accessibilityRole="header" className="font-inter-bold text-desktop-h1 text-text-primary">
                  Найближчі події
                </Text>
                {lastUpdated && loadedEvents.length > 0 && (
                  // FR-014: an import failed, so the imported events are those of its last succeeded run.
                  <Text className="font-inter text-body text-text-secondary">{lastUpdated}</Text>
                )}
              </View>
              {isGuest && (
                <View className="flex-row items-center justify-between gap-4 rounded-2xl bg-surface-card px-4 py-3">
                  <Text className="shrink font-inter text-caption text-text-primary">
                    Каталог відкритий для всіх. Щоб знайти компанію на подію, зареєструйся.
                  </Text>
                  <Button label="Увійти" size="sm" onPress={openGuestDialog} />
                </View>
              )}
              {loading ? (
                <CardGrid
                  items={Array.from({ length: DESKTOP_SKELETON_COUNT }, (_, index) => index)}
                  keyOf={String}
                  render={() => <EventCardSkeleton />}
                />
              ) : (
                <Animated.View entering={FadeIn.duration(DISSOLVE_MS)}>
                  <View className="gap-6">
                    <CardGrid items={events} keyOf={(event) => event.id} render={renderCard} />
                    {notice && <View className="w-[560px] max-w-full self-center">{notice}</View>}
                    {loadMoreControls}
                  </View>
                </Animated.View>
              )}
            </View>
          </View>
        </ScrollView>
        {filtersSheet}
      </>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-surface-background"
        contentContainerStyle={{ paddingBottom: BAR_HEIGHT + tabBarSafeArea(insets.bottom) + LIST_BOTTOM_GAP }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={200}
        onScroll={onScroll}
      >
        {/* Taller than the header, so the first card starts over the gradient, as in Figma. */}
        <View className="absolute left-0 right-0 top-0 h-[484px]">
          <CoralGradient preset="header" />
        </View>

        {isGuest ? (
          <CatalogHeader />
        ) : (
          <CatalogHeader
            name={profile.data?.displayName}
            // Figma hides the unread dot while the catalog loads.
            hasUnread={hasUnread && !loading}
            onNotificationsPress={() => router.push('/notifications')}
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
                <Text className="self-end font-inter text-tag text-text-on-dark">{lastUpdated}</Text>
              )}
              {events.map(renderCard)}
              {notice}
              {loadMoreControls}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {filtersSheet}
    </>
  );
}
