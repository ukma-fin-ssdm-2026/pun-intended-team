// Written with the help of Claude
// AI Usage: chip of the Figma filters sheet with the Default and Selected states; reviewed by Daryna Halytska.
import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

type Props = {
  label: string;
  selected?: boolean;
  // A leading icon in the default state, e.g. the calendar on "Обрати дати"; a selected chip shows a check instead.
  icon?: IconName;
  // Without onPress the chip is shown but cannot be pressed.
  onPress?: () => void;
};

export function FilterChip({ label, selected = false, icon, onPress }: Props) {
  const leading = selected ? 'check' : icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-[18px] py-[9px] pr-4 ${leading ? 'pl-3' : 'pl-4'} ${selected ? 'bg-brand-ink' : 'bg-surface-background'}`}
    >
      {leading && (
        <Icon
          name={leading}
          size={selected ? 14 : 16}
          color={selected ? colors.text['on-dark'] : colors.text.primary}
        />
      )}
      <Text className={`font-inter-medium text-label ${selected ? 'text-text-on-dark' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
