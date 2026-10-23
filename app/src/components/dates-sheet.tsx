// Written with the help of Claude
// AI Usage: date picker sheet from the Figma "Д1.1 Фільтри · Вибір дат" frame; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SelectChip } from '@/components/ui/select-chip';
import { Sheet } from '@/components/ui/sheet';
import { formatMonth, kyivDay, monthOf, monthWeeks, shiftMonth, type KyivDay } from '@/dates';
import { daysOf, setDates, useCatalogFilters, type DateRange, type When } from '@/state/catalog-filters';

const quickOptions: { value: When; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'weekend', label: 'Ці вихідні' },
];

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

function rangeOf(when: When): DateRange {
  const days = daysOf(when);
  return { from: days[0], to: days[days.length - 1] };
}

function sameRange(a: DateRange | null, b: DateRange) {
  return !!a && a.from === b.from && a.to === b.to;
}

// A tap starts a new day, or ends the range when a single later day is already picked; tapping the single day clears it.
function pick(current: DateRange | null, day: KyivDay): DateRange | null {
  if (!current || current.from !== current.to || day < current.from) return { from: day, to: day };
  if (day === current.from) return null;
  return { from: current.from, to: day };
}

function DayCell({
  day,
  today,
  selected,
  onPress,
}: {
  day: KyivDay;
  today: KyivDay;
  selected: boolean;
  onPress: () => void;
}) {
  const past = day < today;
  const text = selected
    ? 'font-inter text-surface-card'
    : past
      ? 'font-inter text-text-secondary opacity-50'
      : day === today
        ? 'font-inter-medium text-brand-coral'
        : 'font-inter text-text-primary';

  return (
    <View className="h-10 flex-1 items-center justify-center">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: past }}
        disabled={past}
        onPress={onPress}
        className={`size-10 items-center justify-center rounded-[20px] ${selected ? 'bg-brand-coral' : ''}`}
      >
        <Text className={`text-body ${text}`}>{Number(day.slice(8))}</Text>
      </Pressable>
    </View>
  );
}

type Props = {
  visible: boolean;
  // "Застосувати" and the backdrop return to Д1; only "Застосувати" keeps the picked days.
  onClose: () => void;
};

export function DatesSheet({ visible, onClose }: Props) {
  const filters = useCatalogFilters();
  const today = kyivDay(new Date());
  const [draft, setDraft] = useState<DateRange | null>(filters.when ? rangeOf(filters.when) : filters.dates);
  const [month, setMonth] = useState(monthOf(draft?.from ?? today));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="flex-row items-center justify-between">
        <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
          Коли
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setDraft(null)} hitSlop={8}>
          <Text className="font-inter-medium text-label text-brand-coral">Скинути</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {quickOptions.map((option) => {
          const range = rangeOf(option.value);
          const selected = sameRange(draft, range);
          return (
            <SelectChip
              key={option.value}
              label={option.label}
              selected={selected}
              onPress={() => {
                setDraft(selected ? null : range);
                if (!selected) setMonth(monthOf(range.from));
              }}
            />
          );
        })}
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Попередній місяць"
            onPress={() => setMonth((current) => shiftMonth(current, -1))}
            hitSlop={10}
          >
            <Icon name="arrow-left" size={20} />
          </Pressable>
          <Text className="font-inter-semibold text-title text-text-primary">{formatMonth(month)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Наступний місяць"
            onPress={() => setMonth((current) => shiftMonth(current, 1))}
            hitSlop={10}
          >
            <Icon name="arrow-right" size={20} />
          </Pressable>
        </View>
        <View className="flex-row">
          {weekdays.map((weekday) => (
            <View key={weekday} className="h-7 flex-1 items-center justify-center">
              <Text className="font-inter text-caption text-text-secondary">{weekday}</Text>
            </View>
          ))}
        </View>
        {monthWeeks(month).map((week) => (
          <View key={week.find(Boolean)} className="flex-row">
            {week.map((day, index) =>
              day ? (
                <DayCell
                  key={day}
                  day={day}
                  today={today}
                  selected={!!draft && day >= draft.from && day <= draft.to}
                  onPress={() => setDraft((current) => pick(current, day))}
                />
              ) : (
                <View key={index} className="h-10 flex-1" />
              ),
            )}
          </View>
        ))}
      </View>

      <Button
        label="Застосувати"
        onPress={() => {
          setDates(draft);
          onClose();
        }}
      />
    </Sheet>
  );
}
