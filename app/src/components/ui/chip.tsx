// Written with the help of Claude
// AI Usage: category chip with the Figma Default and Selected states; reviewed by Daryna Halytska.
import { Pressable, Text } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`items-center rounded-[17px] px-4 py-2 ${selected ? 'bg-brand-coral' : 'bg-surface-card'}`}
    >
      <Text
        numberOfLines={1}
        className={`font-inter-medium text-label ${selected ? 'text-text-on-dark' : 'text-text-primary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
