// Written with the help of Claude
import { Platform, type ViewStyle } from 'react-native';

// A black Figma drop shadow: its offset, its radius and its opacity.
export type ShapeShadow = { offsetY: number; blur: number; opacity: number };

// A shadow that follows a drawn shape, such as the notched bars: iOS shadows the opaque pixels of a transparent view,
// Android 12+ and the web use a drop-shadow filter. Android 10 and 11 draw the shape without a shadow.
export function shapeShadow({ offsetY, blur, opacity }: ShapeShadow): ViewStyle {
  const color = `rgba(0, 0, 0, ${opacity})`;
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: offsetY },
        shadowOpacity: opacity,
        shadowRadius: blur / 2,
      },
      android: { filter: [{ dropShadow: { offsetX: 0, offsetY, standardDeviation: blur / 2, color } }] },
      default: { filter: `drop-shadow(0px ${offsetY}px ${blur}px ${color})` },
    }) ?? {}
  );
}
