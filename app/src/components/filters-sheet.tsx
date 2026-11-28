// Written with the help of Claude
// AI Usage: filters sheet from the Figma "Д1 Фільтри" screen; reviewed by Daryna Halytska.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { components } from '@/api/schema';
import { DatesSheet } from '@/components/dates-sheet';
import { LocationDialog } from '@/components/location-dialog';
import { Button } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/filter-chip';
import { Overlay } from '@/components/ui/overlay';
import { SheetHandle, useSheetEntering, useSheetPadding } from '@/components/ui/sheet';
import { locateUser } from '@/location';
import {
  filterEvents,
  RADIUS_OPTIONS,
  resetFilters,
  setNear,
  setRadius,
  toggleCategory,
  toggleWhen,
  useCatalogFilters,
  type When,
} from '@/state/catalog-filters';

// Shown under "Де" when the location cannot be used; the other filters keep working.
const locationNotices = {
  denied: 'Без доступу до геолокації не покажемо події поруч. Інші фільтри працюють як завжди.',
  failed: 'Не вдалося визначити, де ти. Спробуй ще раз трохи згодом.',
};

const whenOptions: { value: When; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'weekend', label: 'Ці вихідні' },
];

// "Показати 1 подію / 3 події / 12 подій".
function eventsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun =
    lastTwo >= 11 && lastTwo <= 14 ? 'подій' : last === 1 ? 'подію' : last >= 2 && last <= 4 ? 'події' : 'подій';
  return `Показати ${count} ${noun}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text className="font-inter-semibold text-title text-text-primary">{title}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  // The loaded events of the catalog or the map, so the sheet counts what it will show, and the live categories.
  events: components['schemas']['Event'][];
  categories: components['schemas']['Category'][];
};

export function FiltersSheet({ visible, onClose, events, categories }: Props) {
  const entering = useSheetEntering();
  const padding = useSheetPadding(20);
  const filters = useCatalogFilters();
  const count = filterEvents(events, filters).length;
  // "Обрати дати" opens Д1.1 and "Поруч зі мною" Д1.2 in place of the sheet; both return to it.
  const [view, setView] = useState<'filters' | 'dates' | 'location'>('filters');
  const back = () => setView('filters');
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<keyof typeof locationNotices>();

  const turnOnNearMe = async () => {
    back();
    setLocating(true);
    setLocationNotice(undefined);
    const result = await locateUser();
    setLocating(false);
    if (result.status === 'located') setNear(result.point);
    else setLocationNotice(result.status);
  };

  const toggleNearMe = () => {
    if (locating) return;
    if (filters.near) setNear(null);
    else setView('location');
  };

  return (
    <>
      <Overlay visible={visible && view === 'filters'} onClose={onClose} placement="bottom">
        {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
        <Animated.View entering={entering} accessibilityViewIsModal style={{ maxHeight: '90%' }}>
          <View className="shrink gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3" style={padding}>
            <SheetHandle />
            <View className="flex-row items-center justify-between">
              <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
                Фільтри
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  resetFilters();
                  setLocationNotice(undefined);
                }}
                hitSlop={8}
              >
                <Text className="font-inter-medium text-label text-brand-coral">Скинути</Text>
              </Pressable>
            </View>

            <ScrollView className="shrink" contentContainerClassName="gap-5" showsVerticalScrollIndicator={false}>
              <Section title="Категорія">
                {categories.map((category) => (
                  <FilterChip
                    key={category.id}
                    label={category.name}
                    selected={filters.categoryIds.includes(category.id)}
                    onPress={() => toggleCategory(category.id)}
                  />
                ))}
              </Section>
              <Section title="Коли">
                {whenOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    selected={filters.when === option.value}
                    onPress={() => toggleWhen(option.value)}
                  />
                ))}
                <FilterChip
                  label="Обрати дати"
                  icon="calendar"
                  selected={!!filters.dates}
                  onPress={() => setView('dates')}
                />
              </Section>
              <Section title="Де">
                <FilterChip
                  label={locating ? 'Визначаємо, де ти…' : 'Поруч зі мною'}
                  icon="pin"
                  selected={!!filters.near}
                  onPress={toggleNearMe}
                />
                {filters.near &&
                  RADIUS_OPTIONS.map((radiusKm) => (
                    <FilterChip
                      key={radiusKm}
                      label={`До ${radiusKm} км`}
                      selected={filters.radiusKm === radiusKm}
                      onPress={() => setRadius(radiusKm)}
                    />
                  ))}
              </Section>
              {locationNotice && (
                <Text accessibilityLiveRegion="polite" className="-mt-3 font-inter text-caption text-text-secondary">
                  {locationNotices[locationNotice]}
                </Text>
              )}
            </ScrollView>

            <Button label={eventsLabel(count)} variant="dark" onPress={onClose} />
          </View>
        </Animated.View>
      </Overlay>

      {visible && view === 'dates' && <DatesSheet visible onClose={back} />}
      <LocationDialog visible={visible && view === 'location'} onClose={back} onAllow={() => void turnOnNearMe()} />
    </>
  );
}
