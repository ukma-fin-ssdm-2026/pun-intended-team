// Written with the help of Claude
// AI Usage: place picker from the Figma "Д2.1 Новий допис · Місце на мапі" frame, on mock data; reviewed by Daryna
// Halytska.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAP_SEARCH_ICON, MapBackground } from '@/components/map-background';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SearchField } from '@/components/ui/search-field';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockPostPlace } from '@/mocks/map';
import { colors } from '@/styles/tokens';

// "01 Пошук": top padding 56 in the iPhone 14 frame (9 px below its status bar). "02 Обране місце" has a 34 px bottom
// padding.
const SEARCH_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CARD_BOTTOM = 34;
// Figma DROP_SHADOW values (radius as the CSS blur).
const SEARCH_SHADOW = '0px 4px 14px rgba(0, 0, 0, 0.08)';
const DROP_PIN_SHADOW = '0px 6px 12px rgba(0, 0, 0, 0.25)';
// "Мітка / Обране місце": a 48 px pin at (171, 300).
const DROP_PIN = { left: 171, top: 300 };
// The drawn map is a little larger than the frame; dragging stays within it.
const DRAG_LIMIT = 20;

export default function PostPlaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  useStatusBarStyle('dark');

  // "Перетягни мапу, щоб уточнити точку": the map moves under the pin, which stays where it is.
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate((event) => {
      offsetX.value = Math.min(DRAG_LIMIT, Math.max(-DRAG_LIMIT, startX.value + event.translationX));
      offsetY.value = Math.min(DRAG_LIMIT, Math.max(-DRAG_LIMIT, startY.value + event.translationY));
    });
  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  return (
    <View className="flex-1 bg-[#ECECE7]">
      <GestureDetector gesture={pan}>
        <View className="absolute inset-0">
          <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, mapStyle]}>
            <MapBackground />
          </Animated.View>
          <View
            className="absolute size-12 items-center justify-center rounded-3xl border-[3px] border-surface-card bg-brand-coral"
            style={{ left: DROP_PIN.left, top: DROP_PIN.top, boxShadow: DROP_PIN_SHADOW, pointerEvents: 'none' }}
          >
            <Icon name="pin" size={22} color={colors.text['on-dark']} />
          </View>
        </View>
      </GestureDetector>

      <View
        className="flex-row items-start gap-2.5 px-5"
        style={{ paddingTop: Math.max(SEARCH_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          className="size-[50px] items-center justify-center rounded-[25px] bg-surface-card"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <View className="flex-1 rounded-2xl bg-surface-card" style={{ boxShadow: SEARCH_SHADOW }}>
          <SearchField placeholder="Пошук адреси" value={query} onChangeText={setQuery} iconColor={MAP_SEARCH_ICON} />
        </View>
      </View>

      <View
        className="absolute bottom-0 left-0 right-0 items-center gap-4 rounded-t-[28px] bg-surface-card px-5 pt-3"
        style={{ paddingBottom: Math.max(CARD_BOTTOM, insets.bottom) }}
      >
        <View className="h-1 w-10 rounded-sm bg-border-default" />
        <View className="flex-row items-center gap-3.5 self-stretch">
          <View className="size-11 items-center justify-center rounded-[14px] bg-brand-coral">
            <Icon name="pin" size={22} color={colors.text['on-dark']} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
              {mockPostPlace.name}
            </Text>
            <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
              {mockPostPlace.address}
            </Text>
          </View>
        </View>
        <Text className="self-stretch font-inter text-caption text-text-secondary">
          Перетягни мапу, щоб уточнити точку
        </Text>
        {/* "Обрати місце" returns to the post editor (Д2), as in the prototype. */}
        <View className="self-stretch">
          <Button label="Обрати місце" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}
