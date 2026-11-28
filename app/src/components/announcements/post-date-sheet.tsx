// Written with the help of Claude
// AI Usage: "Інша дата" of the post editor; not in Figma, built from the month calendar of "Д1.1 Фільтри · Вибір дат";
// reviewed by Daryna Halytska.
// No desktop frame in Figma; layout derived from 567:7083 (DД1 Фільтри): the sheet is a centered dialog.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { MonthCalendar } from '@/components/month-calendar';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { monthOf, type KyivDay } from '@/dates';

type Props = {
  visible: boolean;
  onClose: () => void;
  // The API takes today or a later day, Kyiv time, with no last day; earlier days and months cannot be picked.
  today: KyivDay;
  // The post's day when the sheet opens.
  initial: KyivDay;
  onPick: (day: KyivDay) => void;
};

export function PostDateSheet({ visible, onClose, today, initial, onPick }: Props) {
  const [draft, setDraft] = useState(initial < today ? today : initial);
  const [month, setMonth] = useState(monthOf(draft));

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="gap-1.5">
        <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
          Коли
        </Text>
        <Text className="font-inter text-caption text-text-secondary">Обери день, коли плануєш піти</Text>
      </View>

      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        today={today}
        firstMonth={monthOf(today)}
        isSelected={(day) => day === draft}
        onPick={setDraft}
      />

      <Button
        label="Обрати"
        onPress={() => {
          onPick(draft);
          onClose();
        }}
      />
    </Sheet>
  );
}
