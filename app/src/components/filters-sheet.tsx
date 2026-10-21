// Written with the help of Claude
// AI Usage: filters sheet from the Figma "Д1 Фільтри" screen; reviewed by Daryna Halytska.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatesSheet } from '@/components/dates-sheet';
import { LocationDialog } from '@/components/location-dialog';
import { Button } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/filter-chip';
import { Overlay } from '@/components/ui/overlay';
import { mockCategories, mockDistricts, mockEvents } from '@/mocks/events';
import {
  filterEvents,
  resetFilters,
  setNearMe,
  toggleCategory,
  toggleDistrict,
  toggleWhen,
  useCatalogFilters,
  type When,
} from '@/state/catalog-filters';

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
};

export function FiltersSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const filters = useCatalogFilters();
  const count = filterEvents(mockEvents, filters).length;
  // "Обрати дати" opens Д1.1 and "Поруч зі мною" Д1.2 in place of the sheet; both return to it.
  const [view, setView] = useState<'filters' | 'dates' | 'location'>('filters');
  const back = () => setView('filters');

  return (
    <>
      <Overlay visible={visible && view === 'filters'} onClose={onClose} placement="bottom">
        {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
        <Animated.View entering={SlideInDown.duration(250)} accessibilityViewIsModal style={{ maxHeight: '90%' }}>
          <View
            className="shrink gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            <View className="items-center">
              <View className="h-1 w-10 rounded-sm bg-border-default" />
            </View>
            <View className="flex-row items-center justify-between">
              <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
                Фільтри
              </Text>
              <Pressable accessibilityRole="button" onPress={resetFilters} hitSlop={8}>
                <Text className="font-inter-medium text-label text-brand-coral">Скинути</Text>
              </Pressable>
            </View>

            <ScrollView className="shrink" contentContainerClassName="gap-5" showsVerticalScrollIndicator={false}>
              <Section title="Категорія">
                {mockCategories.map((category) => (
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
                  label="Поруч зі мною"
                  icon="pin"
                  selected={filters.nearMe}
                  onPress={() => (filters.nearMe ? setNearMe(false) : setView('location'))}
                />
                {mockDistricts.map((district) => (
                  <FilterChip
                    key={district}
                    label={district}
                    selected={filters.districts.includes(district)}
                    onPress={() => toggleDistrict(district)}
                  />
                ))}
              </Section>
            </ScrollView>

            <Button label={eventsLabel(count)} variant="dark" onPress={onClose} />
          </View>
        </Animated.View>
      </Overlay>

      {visible && view === 'dates' && <DatesSheet visible onClose={back} />}
      <LocationDialog
        visible={visible && view === 'location'}
        onClose={back}
        onAllow={() => {
          setNearMe(true);
          back();
        }}
      />
    </>
  );
}
