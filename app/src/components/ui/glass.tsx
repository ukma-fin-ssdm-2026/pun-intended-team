// Written with the help of Claude
// AI Usage: glass surface with the Figma background blur over expo-blur; reviewed by Daryna Halytska.
import { BlurView } from 'expo-blur';
import type { ReactNode, RefObject } from 'react';
import { PixelRatio, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

// Figma's BACKGROUND_BLUR radius is twice the CSS blur it exports: radius 12 is `backdrop-filter: blur(6px)`.
const DEFAULT_RADIUS = 12;
// expo-blur draws its web blur at 0.2 px per intensity unit; iOS uses the same scale, so 12 becomes intensity 30.
const PX_PER_INTENSITY = 0.2;
// Android tints the blur by `intensity` and blurs by `intensity / blurReductionFactor`. Intensity 1 keeps the system
// tint under 1%, so the Figma fill on top is the only tint, and the reduction factor sets the radius instead.
const ANDROID_INTENSITY = 1;
// Android blurs only Android 12 (API 31) and newer smoothly; older versions show the fill without blur.
const ANDROID_MIN_API = 31;

type Props = {
  // Size, padding, position and content layout; the fill, border and corner radius come from the props below.
  className?: string;
  style?: ViewStyle;
  // Figma corner radius, shared by the blur, the fill and the border.
  radius: number;
  // Figma fill and border drawn over the blur, e.g. 'rgba(255, 255, 255, 0.28)'.
  fill: string;
  border?: string;
  // Figma BACKGROUND_BLUR radius.
  blur?: number;
  // Dark glass uses the dark system material on iOS, light glass the light one.
  tone: 'light' | 'dark';
  // Android blurs only what is inside a BlurTargetView, given here; the glass must not be inside it. Without a target
  // Android shows the fill alone.
  blurTarget?: RefObject<View | null>;
  children?: ReactNode;
};

function BlurLayer({ blur, tone, blurTarget }: Pick<Props, 'tone' | 'blurTarget'> & { blur: number }) {
  const cssBlur = blur / 2;

  if (Platform.OS === 'web') {
    // The exact Figma CSS; expo-blur's web view would add its own saturation and tint.
    const backdrop = `blur(${cssBlur}px)`;
    return (
      <View
        style={[StyleSheet.absoluteFill, { backdropFilter: backdrop, WebkitBackdropFilter: backdrop } as ViewStyle]}
      />
    );
  }

  if (Platform.OS === 'android') {
    if (!blurTarget || (Platform.Version as number) < ANDROID_MIN_API) return null;
    const radiusPx = PixelRatio.getPixelSizeForLayoutSize(cssBlur);
    return (
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={ANDROID_INTENSITY}
        blurReductionFactor={ANDROID_INTENSITY / radiusPx}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <BlurView
      tint={tone === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
      intensity={Math.min(100, cssBlur / PX_PER_INTENSITY)}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function Glass({
  className,
  style,
  radius,
  fill,
  border,
  blur = DEFAULT_RADIUS,
  tone,
  blurTarget,
  children,
}: Props) {
  // Bottom to top: blur, fill and border, content; the corner radius clips all three. On the web the two layers are
  // absolutely positioned, and a browser paints positioned boxes over unpositioned ones such as an icon's <svg>, so the
  // content gets its own positioned View above them.
  return (
    <View className={className} style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurLayer blur={blur} tone={tone} blurTarget={blurTarget} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: fill, borderWidth: border ? 1 : 0, borderColor: border },
        ]}
      />
      {children !== undefined && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { position: 'relative', zIndex: 1 },
});
