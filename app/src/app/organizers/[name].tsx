// Written with the help of Claude
// AI Usage: placeholder route for the organizer page, which is not designed yet; reviewed by Daryna Halytska.
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useStatusBarStyle } from '@/hooks/use-status-bar-style';

// Opened from the organizer row of the event page; the stack header gives it a way back.
export default function OrganizerScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  useStatusBarStyle('dark');

  return (
    <View className="flex-1 items-center justify-center gap-2 bg-surface-background px-5">
      <Stack.Screen options={{ title: name }} />
      <Text className="font-inter-semibold text-title text-text-primary">{name}</Text>
      <Text className="text-center font-inter text-caption text-text-secondary">
        Сторінка організатора зʼявиться згодом
      </Text>
    </View>
  );
}
