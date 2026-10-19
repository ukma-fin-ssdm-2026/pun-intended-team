// Written with the help of Claude
// AI Usage: bottom tab bar with the Figma notch for the active tab and its Smart Animate transition; reviewed by Daryna
// Halytska.
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { BAR_HEIGHT, tabBarPath } from '@/components/ui/tab-bar-shape';
import { Icon, type IconName } from '@/components/ui/icon';
import { colors, shadows, tabBarShadow } from '@/styles/tokens';

export type TabName = 'events' | 'map' | 'matches' | 'announcements' | 'profile';

const tabs: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'events', label: 'Події', icon: 'home' },
  { name: 'map', label: 'Мапа', icon: 'pin' },
  { name: 'matches', label: 'Метчі', icon: 'matches' },
  { name: 'announcements', label: 'Оголошення', icon: 'list' },
  { name: 'profile', label: 'Профіль', icon: 'user' },
];

const SIDE_PADDING = 20;
const CIRCLE_SIZE = 56;
// The active icon sits 10 px higher, inside the coral circle.
const ICON_LIFT = 10;

// Figma switches the TabBar variants with Smart Animate, 400 ms, ease in and out (CSS ease-in-out).
const TRANSITION = { duration: 400, easing: Easing.bezier(0.42, 0, 0.58, 1) };

// A shadow that follows the drawn shape: iOS shadows the opaque pixels of a transparent view, Android 12+ and the web
// use a drop-shadow filter. Android 10 and 11 draw the bar without a shadow.
const { offsetY, blur, color } = tabBarShadow;
const shapeShadow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: 0.06,
      shadowRadius: blur / 2,
    },
    android: { filter: [{ dropShadow: { offsetX: 0, offsetY, standardDeviation: blur / 2, color } }] },
    default: { filter: `drop-shadow(0px ${offsetY}px ${blur}px ${color})` },
  }) ?? {};

const centerOf = (index: number, width: number) => {
  'worklet';
  return SIDE_PADDING + (index + 0.5) * ((width - 2 * SIDE_PADDING) / tabs.length);
};

// The transition runs from one tab to another, so only those two change, as between two Figma variants.
type Transition = { from: SharedValue<number>; to: SharedValue<number>; progress: SharedValue<number> };

// How active tab `index` looks right now, from 0 (inactive) to 1 (active).
const activeAmount = (index: number, { from, to, progress }: Transition) => {
  'worklet';
  if (index === to.value) return from.value === to.value ? 1 : progress.value;
  if (index === from.value) return 1 - progress.value;
  return 0;
};

function TabContent({ tab, index, transition }: { tab: (typeof tabs)[number]; index: number; transition: Transition }) {
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -ICON_LIFT * activeAmount(index, transition) }],
  }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: activeAmount(index, transition) }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - activeAmount(index, transition) }));

  return (
    <>
      <Animated.View style={iconStyle}>
        <Animated.View style={inactiveStyle}>
          <Icon name={tab.icon} color={colors.text.secondary} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, activeIconStyle]}>
          <Icon name={tab.icon} color={colors.text['on-dark']} />
        </Animated.View>
      </Animated.View>
      {/* At 320 px a tab is 56 px wide, narrower than "Оголошення"; the label may overhang its tab. */}
      <Animated.View
        style={[
          { position: 'absolute', left: -12, right: -12, top: 28, alignItems: 'center', pointerEvents: 'none' },
          inactiveStyle,
        ]}
      >
        <Text numberOfLines={1} className="font-inter text-tag text-text-secondary">
          {tab.label}
        </Text>
      </Animated.View>
    </>
  );
}

type Props = {
  active: TabName;
  onTabPress: (tab: TabName) => void;
  // White space under the tabs down to the screen edge; the bar shape grows by it.
  bottomPadding?: number;
};

export function TabBar({ active, onTabPress, bottomPadding = 0 }: Props) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const activeIndex = tabs.findIndex((tab) => tab.name === active);
  const height = BAR_HEIGHT + bottomPadding;

  const barWidth = useSharedValue(0);
  const from = useSharedValue(activeIndex);
  const to = useSharedValue(activeIndex);
  const progress = useSharedValue(1);
  const transition = { from, to, progress };
  // The notch is an SVG path: its centre comes back from the animation each frame and the path is redrawn with the
  // exact Figma geometry, which works the same on iOS, Android and the web.
  const [notchCenter, setNotchCenter] = useState<number>();

  useEffect(() => {
    if (activeIndex === to.get()) return;
    from.set(to.get());
    to.set(activeIndex);
    progress.set(0);
    progress.set(reduceMotion ? 1 : withTiming(1, TRANSITION));
  }, [activeIndex, reduceMotion, from, to, progress]);

  useAnimatedReaction(
    () => {
      const w = barWidth.value;
      return w === 0
        ? undefined
        : centerOf(from.value, w) + (centerOf(to.value, w) - centerOf(from.value, w)) * progress.value;
    },
    (center, previous) => {
      if (center !== undefined && center !== previous) scheduleOnRN(setNotchCenter, center);
    },
  );

  const circleStyle = useAnimatedStyle(() => {
    const w = barWidth.value;
    const center = centerOf(from.value, w) + (centerOf(to.value, w) - centerOf(from.value, w)) * progress.value;
    return { transform: [{ translateX: center - CIRCLE_SIZE / 2 }] };
  });

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => {
        const layoutWidth = event.nativeEvent.layout.width;
        barWidth.set(layoutWidth);
        setWidth(layoutWidth);
      }}
      className="w-full flex-row px-5 pt-3"
      style={{ height }}
    >
      {width > 0 && (
        <>
          <View className="absolute left-0 top-0" style={[shapeShadow, { pointerEvents: 'none' }]}>
            <Svg width={width} height={height}>
              <Path
                d={tabBarPath(width, notchCenter ?? centerOf(activeIndex, width), height)}
                fill={colors.surface.card}
              />
            </Svg>
          </View>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                top: -14,
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                backgroundColor: colors.brand.coral,
                boxShadow: shadows.tabActive,
                pointerEvents: 'none',
              },
              circleStyle,
            ]}
          />
        </>
      )}

      {tabs.map((tab, index) => (
        <Pressable
          key={tab.name}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.name === active }}
          onPress={() => onTabPress(tab.name)}
          className="h-12 flex-1 items-center"
        >
          <TabContent tab={tab} index={index} transition={transition} />
        </Pressable>
      ))}
    </View>
  );
}
