// Written with the help of Claude
// AI Usage: settings toggle with the Figma On and Off states; reviewed by Daryna Halytska.
import { Pressable, View } from 'react-native';

import { shadows } from '@/styles/tokens';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
};

export function Toggle({ value, onValueChange, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      className={`h-7 w-[46px] justify-center rounded-[14px] ${value ? 'bg-brand-coral' : 'bg-border-default'}`}
    >
      <View
        className="size-[22px] rounded-full bg-surface-card"
        style={{ marginLeft: value ? 21 : 3, boxShadow: shadows.toggleKnob }}
      />
    </Pressable>
  );
}
