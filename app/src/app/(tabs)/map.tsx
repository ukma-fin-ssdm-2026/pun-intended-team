// Written with the help of Claude
// AI Usage: venue map from the Figma "Т1 Мапа" frame (FR-012, FR-013, US-007), on the catalog's events; reviewed by
// Daryna Halytska.
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FiltersSheet } from '@/components/filters-sheet';
import type { MapPoint } from '@/components/map/kyiv';
import { VenueMap } from '@/components/map/venue-map';
import { eventsLabel, matchesMapSearch, venuesOf } from '@/components/map/venue-pins';
import { MAP_SEARCH_ICON } from '@/components/map-background';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SearchField } from '@/components/ui/search-field';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useEvents, useVenueEvents } from '@/hooks/use-events';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { eventQuery, filterEvents, useCatalogFilters } from '@/state/catalog-filters';
import { colors } from '@/styles/tokens';

// "01 Пошук": top padding 56 in the iPhone 14 frame (9 px below its status bar). The venue card keeps 26 px above the
// tab bar (Figma: bottom padding 110 = 72 + 12 + 26).
const SEARCH_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CARD_GAP_ABOVE_BAR = 26;
// Figma DROP_SHADOW values (radius as the CSS blur).
const SEARCH_SHADOW = '0px 4px 14px rgba(0, 0, 0, 0.08)';
const CARD_SHADOW = '0px -4px 20px rgba(0, 0, 0, 0.08)';
// Figma shows two events; more scroll inside the card.
const EVENT_LIST_MAX_HEIGHT = 200;

// FR-012: the user's location centres the map; without permission the map shows the whole city.
function useUserLocation(): MapPoint | undefined {
  const [location, setLocation] = useState<MapPoint>();
  useEffect(() => {
    let cancelled = false;
    const locate = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) setLocation({ lat: coords.latitude, lng: coords.longitude });
    };
    // A refused or failed request leaves the city view.
    locate().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return location;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const filters = useCatalogFilters();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const user = useUserLocation();
  useStatusBarStyle('dark');

  // Every venue of the catalog window gets a pin, so the map loads the pages one after another.
  const query = eventQuery(filters);
  const events = useEvents(query);
  const { hasMore, loadMore, loadMoreFailed } = events;
  useEffect(() => {
    if (hasMore && !loadMoreFailed) loadMore();
  }, [hasMore, loadMore, loadMoreFailed]);

  // The filters narrow the pins as they narrow the catalog; the search also matches venue names.
  const matches = (list: NonNullable<typeof events.data>) =>
    filterEvents(list, filters).filter((event) => matchesMapSearch(event, search));
  const venues = venuesOf(matches(events.data ?? []));
  const pins = venues.map(({ venue, events: venueEvents }) => ({
    id: venue.id,
    location: venue.location,
    count: venueEvents.length,
    name: venue.name,
  }));
  const selected = venues.find(({ venue }) => venue.id === selectedId);
  const venueEvents = useVenueEvents(selected?.venue.id, query);
  const cardEvents = venueEvents.data ? matches(venueEvents.data.items) : undefined;

  const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });
  const cardBottom = BAR_HEIGHT + tabBarSafeArea(insets.bottom) + CARD_GAP_ABOVE_BAR;

  return (
    <View className="flex-1 bg-[#ECECE7]">
      <VenueMap pins={pins} selectedId={selected?.venue.id} user={user} onPinPress={setSelectedId} />

      <View
        className="flex-row items-start gap-2.5 px-5"
        // The map stays usable around the search row.
        style={{ paddingTop: Math.max(SEARCH_TOP, insets.top + GAP_BELOW_STATUS_BAR), pointerEvents: 'box-none' }}
      >
        <View className="flex-1 rounded-2xl bg-surface-card" style={{ boxShadow: SEARCH_SHADOW }}>
          <SearchField
            placeholder="Заклад або подія"
            value={search}
            onChangeText={setSearch}
            iconColor={MAP_SEARCH_ICON}
          />
        </View>
        <IconButton icon="filter" accessibilityLabel="Фільтри" onPress={() => setFiltersOpen(true)} />
      </View>

      {events.error ? (
        <View
          className="absolute left-5 right-5 gap-3 rounded-[20px] bg-surface-card p-4"
          style={{ bottom: cardBottom, boxShadow: CARD_SHADOW }}
        >
          <Text className="font-inter-semibold text-body text-text-primary">Не вдалося завантажити події</Text>
          <Button label="Спробувати ще раз" size="sm" onPress={events.reload} />
        </View>
      ) : (
        selected && (
          <View
            className="absolute bottom-0 left-0 right-0 gap-3 rounded-t-[28px] bg-surface-card px-5 pt-2.5"
            style={{ paddingBottom: cardBottom, boxShadow: CARD_SHADOW }}
          >
            <View className="items-center">
              <View className="h-1 w-10 rounded-sm bg-border-default" />
            </View>
            <View className="flex-row items-center gap-3">
              <View className="size-11 items-center justify-center rounded-[14px] bg-brand-coral">
                <Icon name="pin" size={22} color={colors.text['on-dark']} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-inter-semibold text-title text-text-primary">{selected.venue.name}</Text>
                <Text className="font-inter text-caption text-text-secondary">{selected.venue.address}</Text>
              </View>
              <Text className="font-inter-medium text-label text-brand-coral">
                {eventsLabel(selected.events.length)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрити"
                hitSlop={8}
                onPress={() => setSelectedId(undefined)}
              >
                <Icon name="close" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
            <ScrollView
              className="rounded-[20px] bg-surface-background px-3 py-1"
              style={{ maxHeight: EVENT_LIST_MAX_HEIGHT }}
            >
              {cardEvents ? (
                cardEvents.map((event, index) => (
                  <View key={event.id}>
                    {index > 0 && <View className="h-px bg-border-default" />}
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openEvent(event.id)}
                      className="flex-row items-center gap-3 py-2.5"
                    >
                      <View className="size-11 items-center justify-center overflow-hidden rounded-xl bg-brand-coral-soft">
                        {event.imageUrl ? (
                          <Image
                            source={{ uri: event.imageUrl }}
                            contentFit="cover"
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : (
                          <Icon name="calendar" size={20} color={colors.brand.coral} />
                        )}
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
                          {event.title}
                        </Text>
                        <Text className="font-inter text-caption text-text-secondary">
                          {formatEventDate(event.startsAt)}
                        </Text>
                      </View>
                      <Icon name="arrow-right" size={18} color={colors.text.secondary} />
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text className="py-3 font-inter text-caption text-text-secondary">
                  {venueEvents.failure ? 'Не вдалося завантажити події закладу.' : 'Завантаження…'}
                </Text>
              )}
            </ScrollView>
          </View>
        )
      )}

      <FiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </View>
  );
}
