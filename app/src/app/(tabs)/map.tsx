// Written with the help of Claude
// AI Usage: static map from the Figma "Т1 Мапа" frame, on mock data; reviewed by Daryna Halytska.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FiltersSheet } from '@/components/filters-sheet';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SearchField } from '@/components/ui/search-field';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { mapPins, mapShapes, mapYouAreHere, mockVenue } from '@/mocks/map';
import { colors } from '@/styles/tokens';

// "01 Пошук": top padding 56 in the iPhone 14 frame (9 px below its status bar). The venue card keeps 16 px above the
// tab bar (Figma: bottom padding 110 = 72 + 22 + 16).
const SEARCH_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CARD_GAP_ABOVE_BAR = 16;
// Figma DROP_SHADOW values (radius as the CSS blur).
const PIN_SHADOW = '0px 4px 10px rgba(0, 0, 0, 0.2)';
const SEARCH_SHADOW = '0px 4px 14px rgba(0, 0, 0, 0.08)';
const CARD_SHADOW = '0px -4px 20px rgba(0, 0, 0, 0.08)';
// "Ви тут": the location blue with its 10 px halo at 25%.
const LOCATION_BLUE = '#2E5CD4';
const LOCATION_HALO = 'rgba(46, 92, 212, 0.25)';
const SEARCH_ICON = '#1A1A2E';

function MapBackground() {
  return (
    <View className="absolute inset-0 overflow-hidden bg-[#ECECE7]" style={{ pointerEvents: 'none' }}>
      {mapShapes.map((shape, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            // Rotated around its centre, which stays at the centre of Figma's bounding box.
            left: shape.left + (shape.boxWidth - shape.width) / 2,
            top: shape.top + (shape.boxHeight - shape.height) / 2,
            width: shape.width,
            height: shape.height,
            borderRadius: shape.radius,
            backgroundColor: shape.color,
            transform: [{ rotate: `${shape.rotate}deg` }],
          }}
        />
      ))}
      {mapPins.map((pin, index) => (
        <View
          key={index}
          className={`absolute items-center justify-center border-[3px] border-white ${pin.selected ? 'bg-brand-coral' : 'bg-brand-ink'}`}
          style={{
            left: pin.left,
            top: pin.top,
            width: pin.size,
            height: pin.size,
            borderRadius: pin.size / 2,
            boxShadow: PIN_SHADOW,
          }}
        >
          <Text className="font-inter-medium text-label text-text-on-dark">{pin.count}</Text>
        </View>
      ))}
      <View
        className="absolute size-[38px] items-center justify-center rounded-full"
        style={{ left: mapYouAreHere.left - 10, top: mapYouAreHere.top - 10, backgroundColor: LOCATION_HALO }}
      >
        <View
          className="size-[18px] rounded-full border-[3px] border-white"
          style={{ backgroundColor: LOCATION_BLUE }}
        />
      </View>
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  useStatusBarStyle('dark');

  const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } });

  return (
    <View className="flex-1">
      <MapBackground />

      <View
        className="flex-row items-start gap-2.5 px-5"
        style={{ paddingTop: Math.max(SEARCH_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <View className="flex-1 rounded-2xl bg-surface-card" style={{ boxShadow: SEARCH_SHADOW }}>
          <SearchField placeholder="Заклад або подія" value={query} onChangeText={setQuery} iconColor={SEARCH_ICON} />
        </View>
        <IconButton icon="filter" accessibilityLabel="Фільтри" onPress={() => setFiltersOpen(true)} />
      </View>

      <View
        className="absolute bottom-0 left-0 right-0 gap-3 rounded-t-[28px] bg-surface-card px-5 pt-2.5"
        style={{
          paddingBottom: BAR_HEIGHT + tabBarSafeArea(insets.bottom) + CARD_GAP_ABOVE_BAR,
          boxShadow: CARD_SHADOW,
        }}
      >
        <View className="items-center">
          <View className="h-1 w-10 rounded-sm bg-border-default" />
        </View>
        <View className="flex-row items-center gap-3">
          <View className="size-11 items-center justify-center rounded-[14px] bg-brand-coral">
            <Icon name="pin" size={22} color={colors.text['on-dark']} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-inter-semibold text-title text-text-primary">{mockVenue.name}</Text>
            <Text className="font-inter text-caption text-text-secondary">{mockVenue.address}</Text>
          </View>
          <Text className="font-inter-medium text-label text-brand-coral">{mockVenue.eventsLabel}</Text>
        </View>
        <View className="rounded-[20px] bg-surface-background px-3 py-1">
          {mockVenue.events.map((item, index) => {
            const event = findMockEvent(item.eventId);
            const cover = event?.cover;
            const date = event && formatEventDate(event.startsAt);
            return (
              <View key={item.key}>
                {index > 0 && <View className="h-px bg-border-default" />}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openEvent(item.eventId)}
                  className="flex-row items-center gap-3 py-2.5"
                >
                  <View className="size-11 overflow-hidden rounded-xl">
                    {cover && <Image source={cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />}
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="font-inter-medium text-body text-text-primary">{item.title}</Text>
                    <Text className="font-inter text-caption text-text-secondary">{date}</Text>
                  </View>
                  <Icon name="arrow-right" size={18} color={colors.text.secondary} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <FiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </View>
  );
}
