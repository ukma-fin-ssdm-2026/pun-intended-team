// Written with the help of Claude
// AI Usage: two-handle range slider from the Figma "Слайдер / Діапазон" of "03 Запит на компанію"; reviewed by Daryna
// Halytska.
import { useEffect, useState } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/styles/tokens';

// "Повзунок": a 24 px white circle with a 2 px coral ring and a soft shadow, on a 4 px track.
const THUMB = 24;
const TRACK = 4;
// Easier to grab than the 24 px circle alone.
const HIT_SLOP = 12;

type Props = {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  // How a screen reader names each handle and reads its value, e.g. "Вік від" and "20".
  labels: { low: string; high: string };
  valueText: (value: number) => string;
};

type Handle = 'low' | 'high';

// The range after one handle moves to `value`: a whole step within the bounds, the low one never past the high one.
export function moved(
  handle: Handle,
  value: number,
  low: number,
  high: number,
  min: number,
  max: number,
): [number, number] {
  const clamped = Math.round(Math.min(max, Math.max(min, value)));
  return handle === 'low' ? [Math.min(clamped, high), high] : [low, Math.max(clamped, low)];
}

// A handle's offset from the left edge for `value`, on a slider `width` px wide.
export function handleOffset(value: number, min: number, max: number, width: number): number {
  'worklet';
  return ((value - min) / (max - min)) * Math.max(1, width - THUMB);
}

// "Обраний діапазон": from the centre of the low handle to the centre of the high one, given their offsets.
export function activeTrackFrame(lowX: number, highX: number): { left: number; width: number } {
  'worklet';
  return { left: lowX + THUMB / 2, width: Math.max(0, highX - lowX) };
}

// Whole steps between `min` and `max`. Each handle follows the finger or the mouse (react-native-gesture-handler, so it
// works the same on iOS, Android and the web) and takes the drag from the scroll view around it from the first touch;
// with a screen reader it moves one step at a time. The low handle never passes the high one.
export function RangeSlider({ min, max, low, high, onChange, labels, valueText }: Readonly<Props>) {
  const [width, setWidth] = useState(0);
  const travel = Math.max(1, width - THUMB);
  // The handles' offsets in pixels, moved on the UI thread while dragged; `dragging` keeps a drag from being reset by
  // the values it reports.
  const lowX = useSharedValue(0);
  const highX = useSharedValue(0);
  const startX = useSharedValue(0);
  const dragging = useSharedValue<Handle | null>(null);

  useEffect(() => {
    if (dragging.get() !== 'low') lowX.set(handleOffset(low, min, max, width));
    if (dragging.get() !== 'high') highX.set(handleOffset(high, min, max, width));
  }, [low, high, min, max, width, lowX, highX, dragging]);

  const report = (handle: Handle, value: number) => onChange(...moved(handle, value, low, high, min, max));

  const pan = (handle: Handle) =>
    Gesture.Pan()
      // Active on touch-down, so a drag that starts on a handle is never a scroll of the sheet.
      .minDistance(0)
      .hitSlop(HIT_SLOP)
      .shouldCancelWhenOutside(false)
      .withTestId(`range-slider-${handle}`)
      .onBegin(() => {
        dragging.value = handle;
        startX.value = handle === 'low' ? lowX.value : highX.value;
      })
      .onUpdate(({ translationX }) => {
        const from = handle === 'low' ? 0 : lowX.value;
        const to = handle === 'low' ? highX.value : travel;
        const x = Math.min(to, Math.max(from, startX.value + translationX));
        const before = Math.round(min + ((handle === 'low' ? lowX.value : highX.value) / travel) * (max - min));
        if (handle === 'low') lowX.value = x;
        else highX.value = x;
        const value = Math.round(min + (x / travel) * (max - min));
        if (value !== before) scheduleOnRN(report, handle, value);
      })
      .onFinalize(() => {
        // Settles on the whole step it shows.
        const x = handle === 'low' ? lowX.value : highX.value;
        const snapped = ((Math.round(min + (x / travel) * (max - min)) - min) / (max - min)) * travel;
        if (handle === 'low') lowX.value = snapped;
        else highX.value = snapped;
        dragging.value = null;
      });

  const lowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lowX.value }] }));
  const highStyle = useAnimatedStyle(() => ({ transform: [{ translateX: highX.value }] }));
  const rangeStyle = useAnimatedStyle(() => activeTrackFrame(lowX.value, highX.value));

  const thumb = (handle: Handle) => {
    const value = handle === 'low' ? low : high;
    return (
      <GestureDetector key={handle} gesture={pan(handle)}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={labels[handle]}
          accessibilityValue={{ min, max, now: value, text: valueText(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={({ nativeEvent }: AccessibilityActionEvent) =>
            report(handle, value + (nativeEvent.actionName === 'increment' ? 1 : -1))
          }
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              borderWidth: 2,
              borderColor: colors.brand.coral,
              backgroundColor: colors.surface.card,
              boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
            },
            handle === 'low' ? lowStyle : highStyle,
          ]}
        />
      </GestureDetector>
    );
  };

  return (
    <View
      testID="range-slider"
      style={{ height: THUMB }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        className="absolute left-0 right-0 rounded-sm bg-border-default"
        style={{ top: (THUMB - TRACK) / 2, height: TRACK }}
      />
      {/* "Обраний діапазон" between the handles. Plain styles: NativeWind maps className only on React Native's own
          components, not on Animated.View. */}
      <Animated.View
        testID="range-slider-active"
        style={[
          {
            position: 'absolute',
            top: (THUMB - TRACK) / 2,
            height: TRACK,
            borderRadius: TRACK / 2,
            backgroundColor: colors.brand.coral,
          },
          rangeStyle,
        ]}
      />
      {thumb('low')}
      {thumb('high')}
    </View>
  );
}
