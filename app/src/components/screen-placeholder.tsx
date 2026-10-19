// Written with the help of Claude
// AI Usage: stand-in for screens of later stages, so the Figma prototype links have a target; reviewed by Daryna Halytska.
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStatusBarStyle } from '@/hooks/use-status-bar-style';

type Props = {
  // Figma frame name, e.g. "Т1 Мапа".
  title: string;
  // Under a stack header the header already covers the status bar.
  withHeader?: boolean;
};

export function ScreenPlaceholder({ title, withHeader = false }: Props) {
  const insets = useSafeAreaInsets();
  useStatusBarStyle('dark');

  return (
    <View
      className="flex-1 items-center justify-center gap-2 bg-surface-background px-5"
      style={{ paddingTop: withHeader ? 0 : insets.top }}
    >
      <Text className="font-inter-semibold text-title text-text-primary">{title}</Text>
      <Text className="text-center font-inter text-caption text-text-secondary">
        Екран зʼявиться на наступному етапі
      </Text>
    </View>
  );
}
