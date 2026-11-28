// Written with the help of Claude
// AI Usage: the month calendar of the Figma "Д1.1 Фільтри · Вибір дат" frame, shared by the catalog's dates sheet and
// the post's date sheet; reviewed by Daryna Halytska.
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { formatMonth, monthWeeks, shiftMonth, type CalendarMonth, type KyivDay } from '@/dates';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

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
  month: CalendarMonth;
  onMonthChange: (month: CalendarMonth) => void;
  // Days before it cannot be picked.
  today: KyivDay;
  isSelected: (day: KyivDay) => boolean;
  onPick: (day: KyivDay) => void;
  // The month the calendar cannot go back from; without it, every month.
  firstMonth?: CalendarMonth;
};

export function MonthCalendar({ month, onMonthChange, today, isSelected, onPick, firstMonth }: Props) {
  const atFirst = !!firstMonth && firstMonth.year === month.year && firstMonth.month === month.month;

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Попередній місяць"
          accessibilityState={{ disabled: atFirst }}
          disabled={atFirst}
          onPress={() => onMonthChange(shiftMonth(month, -1))}
          hitSlop={10}
          className={atFirst ? 'opacity-30' : ''}
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <Text className="font-inter-semibold text-title text-text-primary">{formatMonth(month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Наступний місяць"
          onPress={() => onMonthChange(shiftMonth(month, 1))}
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
              <DayCell key={day} day={day} today={today} selected={isSelected(day)} onPress={() => onPick(day)} />
            ) : (
              <View key={index} className="h-10 flex-1" />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
