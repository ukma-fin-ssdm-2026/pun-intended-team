// Written with the help of Claude
// AI Usage: the event page's action bar from the Figma "таб бар новий" frame, with its pulsing "Знайти метч" button;
// reviewed by Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { shapeShadow } from '@/components/ui/shape-shadow';
import { actionBarPath } from '@/components/ui/tab-bar-shape';
import { actionBarShadow, colors, shadows } from '@/styles/tokens';

const tail1: ImageSource = require('@/assets/images/match-orbit/tail-1.png');
const tail2: ImageSource = require('@/assets/images/match-orbit/tail-2.png');

// "03 Панель дії" is 96 px at the bottom of the frame: 62 px above its 34 px safe area. A larger bottom inset replaces
// the 34 px.
const BAR_ABOVE_SAFE_AREA = 62;
const MIN_SAFE_AREA = 34;
// The 66 px button rises 14 px above the bar's top edge, into the notch.
const BUTTON_HEIGHT = 66;
const BUTTON_LIFT = 14;
const BUTTON_MIN_WIDTH = 232;
// Figma pulses the button: 1 → 1.03 → 1 over 2.4 s, ease in and out, in a loop.
const PULSE_SCALE = 1.03;
const PULSE_HALF = { duration: 1200, easing: Easing.bezier(0.42, 0, 0.58, 1) };

const barShadow = shapeShadow(actionBarShadow);

export const actionBarSafeArea = (bottomInset: number) => Math.max(bottomInset, MIN_SAFE_AREA);

// How far the bar and its button reach up from the bottom of the screen, for the content to clear them.
export const actionBarReach = (bottomInset: number) =>
  BUTTON_LIFT + BAR_ABOVE_SAFE_AREA + actionBarSafeArea(bottomInset);

// "Іконка / Метч (орбіта)": two glowing points circling on two tails, 24 px. Figma's points carry a blurred glow,
// drawn here as a box shadow, which renders the same on every platform.
function OrbitIcon() {
  return (
    <View style={{ width: 24, height: 24 }}>
      <View style={{ position: 'absolute', left: 3, top: 3, width: 18, height: 18, transform: [{ rotate: '-30deg' }] }}>
        <Image source={tail1} style={{ position: 'absolute', left: 0.38, top: 0, width: 17.074, height: 6.93 }} />
        <Image source={tail2} style={{ position: 'absolute', left: 0.55, top: 11.07, width: 17.074, height: 6.93 }} />
      </View>
      <GlowPoint left={14} top={2.59} size={6.4} />
      <GlowPoint left={4.2} top={15.61} size={5.2} />
    </View>
  );
}

function GlowPoint({ left, top, size }: { left: number; top: number; size: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.text['on-dark'],
        boxShadow: '0px 0px 4.8px rgba(255, 255, 255, 0.8)',
      }}
    />
  );
}

type Props = {
  // "Знайти метч", or the state labels "Стежити за метчингом" and "Відкрити метч".
  label: string;
  onPress: () => void;
  bottomInset: number;
};

// The white bar with the notch at the bottom of the event page, and the coral button sitting in the notch.
export function MatchActionBar({ label, onPress, bottomInset }: Props) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const height = BAR_ABOVE_SAFE_AREA + actionBarSafeArea(bottomInset);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.set(reduceMotion ? 1 : withRepeat(withTiming(PULSE_SCALE, PULSE_HALF), -1, true));
  }, [reduceMotion, scale]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View
      className="absolute bottom-0 left-0 right-0 items-center"
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <View className="absolute left-0 top-0" style={[barShadow, { pointerEvents: 'none' }]}>
          <Svg width={width} height={height}>
            <Path d={actionBarPath(width, height)} fill={colors.surface.card} />
          </Svg>
        </View>
      )}
      <Animated.View
        style={[{ position: 'absolute', top: -BUTTON_LIFT, maxWidth: width > 0 ? width - 40 : undefined }, pulseStyle]}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
          {({ pressed }) => (
            <View
              className={`flex-row items-center justify-center gap-2 rounded-[40px] px-10 ${
                pressed ? 'bg-brand-coral-dark' : 'bg-brand-coral'
              }`}
              style={{ height: BUTTON_HEIGHT, minWidth: BUTTON_MIN_WIDTH, boxShadow: shadows.matchButton }}
            >
              <OrbitIcon />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className="shrink font-inter-bold text-text-on-dark"
                style={{ fontSize: 19, lineHeight: 24, letterSpacing: 0.095 }}
              >
                {label}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
