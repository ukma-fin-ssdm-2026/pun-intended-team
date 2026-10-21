// Written with the help of Claude
// AI Usage: animated radar from the Figma "04 Пошук компанії" screen, keyframes taken from its motion data; reviewed by
// Daryna Halytska.
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// One 16 s loop drives every layer, as in the Figma timeline.
const LOOP_MS = 16000;
const RADAR_SIZE = 200;

// motion.dev's named easings, which the Figma motion data uses.
const easings = {
  linear: Easing.linear,
  easeIn: Easing.bezier(0.42, 0, 1, 1),
  easeOut: Easing.bezier(0, 0, 0.58, 1),
  easeInOut: Easing.bezier(0.42, 0, 0.58, 1),
};
type EaseName = keyof typeof easings;

type Track = {
  // Keyframe times as fractions of the loop, and the values at them.
  times: number[];
  scale: number[];
  opacity?: number[];
  // One easing for every segment, or one per segment.
  ease: EaseName | EaseName[];
};

// Figma: the inner pulse eases out, swings in and out, and eases in at the end.
const pulse = (segments: number): EaseName[] => [
  'easeOut',
  ...Array<EaseName>(segments - 2).fill('easeInOut'),
  'easeIn',
];

function sequence(values: number[], times: number[], ease: Track['ease']) {
  const steps = values.slice(1).map((value, index) => {
    const easing = easings[Array.isArray(ease) ? ease[index] : ease];
    return withTiming(value, { duration: (times[index + 1] - times[index]) * LOOP_MS, easing });
  });
  return withRepeat(withSequence(...steps), -1);
}

// Figma scales each layer around its own centre; the web defaults to the top-left corner, so every layer gets an
// explicit box and origin instead of taking its size from its content.
function Layer({ track, size, children }: { track: Track; size: number; children?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(track.scale[0]);
  const opacity = useSharedValue(track.opacity?.[0] ?? 1);

  useEffect(() => {
    // With reduced motion the radar rests on its first keyframe.
    if (reduceMotion) return;
    scale.value = sequence(track.scale, track.times, track.ease);
    if (track.opacity) opacity.value = sequence(track.opacity, track.times, track.ease);
  }, [reduceMotion, track, scale, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const offset = (RADAR_SIZE - size) / 2;
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: offset, top: offset, width: size, height: size, transformOrigin: 'center' },
        animated,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Keyframes of "02.1 Радар" (Figma motion data), node by node.
const circle200: Track = {
  times: [0, 0.0012, 0.1262, 0.2512, 0.3762, 0.5012, 0.6262, 0.7512, 0.8762, 1],
  opacity: [0.84, 0.84, 1, 0.84, 1, 0.84, 1, 0.84, 1, 0.84],
  scale: [0.95, 0.95, 1, 0.95, 1, 0.95, 1, 0.95, 1, 0.95],
  ease: pulse(9),
};
const circle150: Track = {
  times: [0, 0.0943, 0.2193, 0.3443, 0.4693, 0.5943, 0.7193, 0.8443, 0.9693, 1],
  opacity: [0.8626, 1, 0.84, 1, 0.84, 1, 0.84, 1, 0.84, 0.8626],
  scale: [0.982, 1.025, 0.975, 1.025, 0.975, 1.025, 0.975, 1.025, 0.975, 0.982],
  ease: pulse(9),
};
const circle100: Track = {
  times: [0, 0.0625, 0.1875, 0.3125, 0.4375, 0.5625, 0.6875, 0.8125, 0.9375, 1],
  opacity: [0.92, 1, 0.84, 1, 0.84, 1, 0.84, 1, 0.84, 0.92],
  scale: [1, 1.025, 0.975, 1.025, 0.975, 1.025, 0.975, 1.025, 0.975, 1],
  ease: pulse(9),
};
const wave1: Track = {
  times: [0, 0.25, 0.2505, 0.2506, 0.5, 0.5005, 0.5006, 0.75, 0.7505, 0.7506, 1],
  opacity: [0.45, 0, 0, 0.45, 0, 0, 0.45, 0, 0, 0.45, 0],
  scale: [0.32, 1, 1, 0.32, 1, 1, 0.32, 1, 1, 0.32, 1],
  ease: 'linear',
};
const wave2: Track = {
  times: [0, 0.125, 0.1255, 0.1256, 0.375, 0.3755, 0.3756, 0.625, 0.6255, 0.6256, 0.875, 0.8755, 0.8756, 1],
  opacity: [0.225, 0, 0, 0.45, 0, 0, 0.45, 0, 0, 0.45, 0, 0, 0.45, 0.225],
  scale: [0.66, 1, 1, 0.32, 1, 1, 0.32, 1, 1, 0.32, 1, 1, 0.32, 0.66],
  ease: 'linear',
};
const avatar: Track = {
  times: Array.from({ length: 17 }, (_, index) => index / 16),
  scale: Array.from({ length: 17 }, (_, index) => (index % 2 === 0 ? 1.025 : 0.975)),
  ease: pulse(16),
};

export function SearchRadar() {
  return (
    <View style={{ width: RADAR_SIZE, height: RADAR_SIZE }}>
      <Layer track={circle200} size={200}>
        <View className="size-[200px] rounded-full bg-white/[0.06]" />
      </Layer>
      <Layer track={circle150} size={150}>
        <View className="size-[150px] rounded-full bg-white/10" />
      </Layer>
      <Layer track={circle100} size={100}>
        <View className="size-[100px] rounded-full bg-white/[0.16]" />
      </Layer>
      {[wave1, wave2].map((wave, index) => (
        <Layer key={index} track={wave} size={200}>
          <View className="size-[200px] rounded-full border-[1.5px] border-white" />
        </Layer>
      ))}
      <Layer track={avatar} size={64}>
        <View
          className="size-16 rounded-full bg-surface-background"
          style={{ boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.12)' }}
        />
      </Layer>
    </View>
  );
}
