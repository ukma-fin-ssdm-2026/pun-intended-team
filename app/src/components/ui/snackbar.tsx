// Written with the help of Claude
// AI Usage: snackbar ("10 Сповіщення (снекбар)") of the Figma Т2.2 and Т3.2 frames; reviewed by Daryna Halytska.
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  title: string;
  note: string;
  // Distance from the bottom of the screen; the screens keep it above the tab bar.
  bottom: number;
};

export function Snackbar({ title, note, bottom }: Props) {
  return (
    <View
      accessibilityRole="alert"
      className="absolute left-5 right-5 flex-row items-center gap-3 overflow-hidden rounded-[18px] bg-brand-ink px-4 py-3.5"
      style={{ bottom, boxShadow: shadows.medium }}
    >
      <View className="size-8 items-center justify-center rounded-2xl bg-brand-coral">
        <Icon name="toast-check" size={18} color={colors.text['on-dark']} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-on-dark">{title}</Text>
        <Text className="font-inter text-caption text-text-on-dark-muted">{note}</Text>
      </View>
    </View>
  );
}
