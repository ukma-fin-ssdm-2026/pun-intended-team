// Written with the help of Claude
// AI Usage: chip that turns coral with a check when selected, as in the Figma П1.2 and Д1.1 sheets; reviewed by
// Daryna Halytska.
import { Pressable, Text } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function SelectChip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-[18px] px-4 py-[9px] ${
        selected ? 'bg-brand-coral' : 'bg-surface-background'
      }`}
    >
      {selected && <Icon name="check-bold" size={16} color={colors.text['on-dark']} />}
      <Text className={`font-inter-medium text-label ${selected ? 'text-text-on-dark' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
