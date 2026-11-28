// Written with the help of Claude
// AI Usage: day picker for a multi-day event before the company request sheet; not in Figma, built from the 03 sheet's
// blocks; reviewed by Viktoriia Baran.
// No desktop frame in Figma; layout derived from 567:7083 (DД1 Фільтри): the sheet is a centered dialog.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { RadioOption } from '@/components/ui/radio-option';
import { Sheet } from '@/components/ui/sheet';
import { formatEventDay, formatTime } from '@/dates';

// About five rows; a month-long exhibition scrolls.
const LIST_MAX_HEIGHT = 340;

type Props = {
  visible: boolean;
  onClose: () => void;
  eventTitle: string;
  // The starts of the sessions that still take applications.
  sessions: string[];
  // False when the event's start is a default opening time: the days are shown without it.
  startTimeKnown?: boolean;
  // The days ticked when the sheet opens: those the user already picked, when changing them.
  initial?: string[];
  onPick: (sessionStarts: string[]) => void;
};

export function DayPickerSheet({
  visible,
  onClose,
  eventTitle,
  sessions,
  startTimeKnown = true,
  initial = [],
  onPick,
}: Props) {
  const [picked, setPicked] = useState<string[]>(initial);
  const toggle = (session: string) =>
    setPicked((current) =>
      current.includes(session) ? current.filter((value) => value !== session) : [...current, session],
    );

  return (
    <Sheet visible={visible} onClose={onClose} gapClass="gap-6">
      <View className="gap-1.5">
        <Text className="font-inter text-caption text-text-secondary">{eventTitle}</Text>
        <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
          Коли тобі буде зручно?
        </Text>
        {sessions.length > 1 && (
          <Text className="font-inter text-caption text-text-secondary">Можна обрати кілька днів</Text>
        )}
      </View>

      {sessions.length > 0 ? (
        <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }}>
          <View className="gap-2.5">
            {sessions.map((session) => (
              <RadioOption
                key={session}
                multiple
                icon="calendar"
                title={formatEventDay(session)}
                note={startTimeKnown ? formatTime(session) : undefined}
                selected={picked.includes(session)}
                onPress={() => toggle(session)}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text className="font-inter text-body text-text-secondary">
          На жоден день цієї події підбір уже не відкритий.
        </Text>
      )}

      <Button
        label="Далі"
        variant="dark"
        disabled={picked.length === 0}
        onPress={() => onPick(sessions.filter((session) => picked.includes(session)))}
      />
    </Sheet>
  );
}
