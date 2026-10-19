// Written with the help of Claude
// AI Usage: rotating spinner over the Figma loading asset; reviewed by Daryna Halytska.
import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import SpinnerLg from '@/assets/images/spinner/spinner-lg.svg';
import SpinnerSm from '@/assets/images/spinner/spinner-sm.svg';

type Props = {
  size: 'sm' | 'lg';
  color: string;
};

export function Spinner({ size, color }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const Svg = size === 'sm' ? SpinnerSm : SpinnerLg;

  return (
    <Animated.View style={style} accessibilityRole="progressbar">
      <Svg color={color} />
    </Animated.View>
  );
}
