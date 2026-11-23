// Written with the help of Claude
// AI Usage: the white fade behind a floating bottom button, from the Figma "04 Дія" of "В7 Заповнення профілю";
// reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/styles/tokens';

// "04 Дія": padding 16 / 20 / 34 / 20 around the button; a larger bottom inset replaces the 34 px.
export const ACTION_FADE_TOP = 16;
const ACTION_FADE_BOTTOM = 34;

export const actionFadeBottom = (bottomInset: number) => Math.max(ACTION_FADE_BOTTOM, bottomInset);

type Props = {
  children: ReactNode;
  // The id of the gradient, unique on the screen.
  id: string;
  // Extra layout for the button row, e.g. centring a button that is not full width.
  style?: StyleProp<ViewStyle>;
};

// Pinned to the bottom of a scrolling screen: the content fades out under the dark button, from clear at the top to
// three quarters white at 40% and white at the bottom. Only the button takes touches; the fade lets them through to
// the content under it.
export function BottomActionFade({ children, id, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute bottom-0 left-0 right-0 px-5"
      style={[
        { paddingTop: ACTION_FADE_TOP, paddingBottom: actionFadeBottom(insets.bottom), pointerEvents: 'box-none' },
        style,
      ]}
    >
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.surface.card} stopOpacity={0} />
            <Stop offset={0.4} stopColor={colors.surface.card} stopOpacity={0.75} />
            <Stop offset={1} stopColor={colors.surface.card} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}
