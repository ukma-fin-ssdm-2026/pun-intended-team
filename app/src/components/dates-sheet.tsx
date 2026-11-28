// Written with the help of Claude
// AI Usage: date picker sheet from the Figma "Д1.1 Фільтри · Вибір дат" frame; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MonthCalendar } from '@/components/month-calendar';
import { Button } from '@/components/ui/button';
import { SelectChip } from '@/components/ui/select-chip';
import { Sheet } from '@/components/ui/sheet';
import { kyivDay, monthOf, type KyivDay } from '@/dates';
import { daysOf, setDates, useCatalogFilters, type DateRange, type When } from '@/state/catalog-filters';

const quickOptions: { value: When; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'weekend', label: 'Ці вихідні' },
];

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

      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        today={today}
        isSelected={(day) => !!draft && day >= draft.from && day <= draft.to}
        onPick={(day) => setDraft((current) => pick(current, day))}
      />

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
