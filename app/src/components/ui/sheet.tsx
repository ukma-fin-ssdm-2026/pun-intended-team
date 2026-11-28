// Written with the help of Claude
// AI Usage: bottom sheet ("01 Шторка") with its handle, over the Overlay backdrop; reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Overlay } from '@/components/ui/overlay';
import { useIsDesktop } from '@/hooks/use-is-desktop';

// "01 Шторка" has a 34 px bottom padding; a larger bottom inset replaces it.
const SHEET_BOTTOM = 34;
// The desktop dialogs (e.g. DД1 Фільтри) have 24 px padding all round.
const DIALOG_PADDING = 24;

// The handle of "01 Шторка"; a desktop dialog has none.
export function SheetHandle() {
  const isDesktop = useIsDesktop();
  if (isDesktop) return null;
  return (
    <View className="items-center">
      <View className="h-1 w-10 rounded-sm bg-border-default" />
    </View>
  );
}

// How a sheet comes in: up from the bottom on a phone, a fade on a desktop, where it is centered.
export function useSheetEntering() {
  return useIsDesktop() ? FadeIn.duration(200) : SlideInDown.duration(250);
}

// The padding of "01 Шторка" on a phone, or of a desktop dialog.
export function useSheetPadding(bottom = SHEET_BOTTOM) {
  const insets = useSafeAreaInsets();
  return useIsDesktop() ? { padding: DIALOG_PADDING } : { paddingBottom: Math.max(bottom, insets.bottom) };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // The gap between the handle and the blocks, 20 px in most sheets.
  gapClass?: string;
};

export function Sheet({ visible, onClose, children, gapClass = 'gap-5' }: Props) {
  const entering = useSheetEntering();
  const padding = useSheetPadding();

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
      <Animated.View entering={entering} accessibilityViewIsModal>
        <View className={`rounded-t-[28px] bg-surface-card px-5 pt-3 ${gapClass}`} style={padding}>
          <SheetHandle />
          {children}
        </View>
      </Animated.View>
    </Overlay>
  );
}
