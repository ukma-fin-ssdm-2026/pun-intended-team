// Written with the help of Claude
// AI Usage: "Прийняти" slider from the Figma "05 Запропонований метч" frame and its 05.2а drag animation; reviewed by
// Daryna Halytska.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

// "Кнопка / Прийняти": 60 px high, padding 8 left and 24 right, a 44 px knob; the label starts after the knob (x 52).
// In 05.2а the knob ends at the right padding and the label at x 8.
const KNOB = 44;
const PADDING_LEFT = 8;
const PADDING_RIGHT = 24;
const LABEL_START = PADDING_LEFT + KNOB;
const LABEL_END = PADDING_LEFT;
// Smart Animate between 05 and 05.2а: 400 ms, ease in and out.
const TRANSITION = { duration: 400, easing: Easing.bezier(0.42, 0, 0.58, 1) };
// Released past this share of the track, the drag completes; before it, the knob returns.
const COMPLETE_AT = 0.5;

type Props = {
  onAccept: () => void;
  disabled?: boolean;
};

export function SwipeAccept({ onAccept, disabled = false }: Props) {
  const [width, setWidth] = useState(0);
  const travel = useSharedValue(0);
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const labelWidth = Math.max(0, width - LABEL_START - PADDING_RIGHT);

  const complete = () => {
    'worklet';
    offset.value = withTiming(travel.value, TRANSITION);
    scheduleOnRN(onAccept);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      start.value = offset.value;
    })
    .onUpdate((event) => {
      offset.value = Math.min(Math.max(start.value + event.translationX, 0), travel.value);
    })
    .onEnd(() => {
      if (travel.value > 0 && offset.value >= travel.value * COMPLETE_AT) complete();
      else offset.value = withTiming(0, TRANSITION);
    });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const labelStyle = useAnimatedStyle(() => {
    const progress = travel.value > 0 ? offset.value / travel.value : 0;
    return { transform: [{ translateX: (LABEL_END - LABEL_START) * progress }] };
  });

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Прийняти"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (disabled) return;
        offset.set(withTiming(travel.get(), TRANSITION));
        onAccept();
      }}
      onLayout={(event) => {
        const layoutWidth = event.nativeEvent.layout.width;
        setWidth(layoutWidth);
        travel.set(Math.max(0, layoutWidth - PADDING_LEFT - KNOB - PADDING_RIGHT));
      }}
      className="h-[60px] flex-1 justify-center rounded-[30px] bg-surface-card"
      style={{ boxShadow: '0px 10px 24px -6px rgba(0, 0, 0, 0.2)' }}
    >
      <Animated.View
        style={[{ position: 'absolute', left: LABEL_START, width: labelWidth, pointerEvents: 'none' }, labelStyle]}
      >
        <Text className="text-center font-inter-semibold text-button text-text-primary">Прийняти</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ position: 'absolute', left: PADDING_LEFT }, knobStyle]}>
          <View className="size-11 items-center justify-center rounded-[22px] bg-brand-ink">
            <Icon name="arrow-long" size={20} color={colors.text['on-dark']} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
