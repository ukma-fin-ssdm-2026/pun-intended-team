// Written with the help of Claude
// AI Usage: selectable option row with an icon and a radio mark, as in the Figma 03 and П1.1 sheets; reviewed by
// Daryna Halytska.
import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

type Props = {
  icon: IconName;
  title: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
};

export function RadioOption({ icon, title, note, selected, onPress }: Props) {
  // Figma draws the 1.5 px selection stroke inside the row, so every row keeps the border (transparent when not
  // selected) and the padding is 1.5 px smaller than Figma's 12 / 16 to leave the content where it is.
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-row items-center gap-3.5 rounded-[18px] border-[1.5px] py-[10.5px] pl-[10.5px] pr-[14.5px] ${
        selected ? 'border-brand-coral bg-surface-card' : 'border-transparent bg-surface-background'
      }`}
    >
      <View
        className={`size-10 items-center justify-center rounded-xl ${selected ? 'bg-brand-coral' : 'bg-surface-card'}`}
      >
        <Icon name={icon} size={20} color={selected ? colors.text['on-dark'] : colors.text.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
        {note && <Text className="font-inter text-caption text-text-secondary">{note}</Text>}
      </View>
      {selected ? (
        <View className="size-5 rounded-full border-[6px] border-brand-coral bg-surface-card" />
      ) : (
        <View className="size-5 rounded-full border-[1.5px] border-border-default" />
      )}
    </Pressable>
  );
}
