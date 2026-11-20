// Written with the help of Claude
// AI Usage: two-handle range slider from the Figma "Слайдер / Діапазон" of "03 Запит на компанію"; reviewed by Daryna
// Halytska.
import { useMemo, useState } from 'react';
import { PanResponder, View, type AccessibilityActionEvent } from 'react-native';

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
function moved(handle: Handle, value: number, low: number, high: number, min: number, max: number): [number, number] {
  const clamped = Math.round(Math.min(max, Math.max(min, value)));
  return handle === 'low' ? [Math.min(clamped, high), high] : [low, Math.max(clamped, low)];
}

// Whole steps between `min` and `max`. Each handle is dragged or, with a screen reader, moved one step at a time; the
// low one never passes the high one.
export function RangeSlider({ min, max, low, high, onChange, labels, valueText }: Readonly<Props>) {
  const [width, setWidth] = useState(0);
  // Where the dragged handle was when the drag began; the drag moves it by the finger's distance from there. Until the
  // render after the grant, the handle has not moved, so its value is the start.
  const [drag, setDrag] = useState<{ handle: Handle; start: number }>();

  const travel = Math.max(1, width - THUMB);
  const offsetOf = (value: number) => ((value - min) / (max - min)) * travel;

  // Rebuilt with the values; React Native reads the handlers of the latest render, also in the middle of a drag.
  const handlers = useMemo(() => {
    const responder = (handle: Handle) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Inside a scrolling sheet the drag stays with the handle.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => setDrag({ handle, start: handle === 'low' ? low : high }),
        onPanResponderMove: (_event, { dx }) => {
          const start = drag?.handle === handle ? drag.start : handle === 'low' ? low : high;
          const span = Math.max(1, width - THUMB);
          onChange(...moved(handle, start + (dx / span) * (max - min), low, high, min, max));
        },
        onPanResponderRelease: () => setDrag(undefined),
        onPanResponderTerminate: () => setDrag(undefined),
      });
    return { low: responder('low'), high: responder('high') };
  }, [drag, low, high, width, min, max, onChange]);

  const thumb = (handle: Handle) => {
    const value = handle === 'low' ? low : high;
    return (
      <View
        key={handle}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={labels[handle]}
        accessibilityValue={{ min, max, now: value, text: valueText(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }: AccessibilityActionEvent) =>
          onChange(...moved(handle, value + (nativeEvent.actionName === 'increment' ? 1 : -1), low, high, min, max))
        }
        hitSlop={HIT_SLOP}
        {...handlers[handle].panHandlers}
        style={{
          position: 'absolute',
          top: 0,
          left: offsetOf(value),
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          borderWidth: 2,
          borderColor: colors.brand.coral,
          backgroundColor: colors.surface.card,
          boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
        }}
      />
    );
  };

  return (
    <View style={{ height: THUMB }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View
        className="absolute left-0 right-0 rounded-sm bg-border-default"
        style={{ top: (THUMB - TRACK) / 2, height: TRACK }}
      />
      <View
        className="absolute rounded-sm bg-brand-coral"
        style={{
          top: (THUMB - TRACK) / 2,
          height: TRACK,
          left: offsetOf(low) + THUMB / 2,
          width: offsetOf(high) - offsetOf(low),
        }}
      />
      {thumb('low')}
      {thumb('high')}
    </View>
  );
}
