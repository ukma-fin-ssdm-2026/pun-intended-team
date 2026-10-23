// Written with the help of Claude
// AI Usage: bottom sheet ("01 Шторка") with its handle, over the Overlay backdrop; reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Overlay } from '@/components/ui/overlay';

// "01 Шторка" has a 34 px bottom padding; a larger bottom inset replaces it.
const SHEET_BOTTOM = 34;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // The gap between the handle and the blocks, 20 px in most sheets.
  gapClass?: string;
};

export function Sheet({ visible, onClose, children, gapClass = 'gap-5' }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      {/* NativeWind maps className only on React Native's own components, so the layout sits on a View inside. */}
      <Animated.View entering={SlideInDown.duration(250)} accessibilityViewIsModal>
        <View
          className={`rounded-t-[28px] bg-surface-card px-5 pt-3 ${gapClass}`}
          style={{ paddingBottom: Math.max(SHEET_BOTTOM, insets.bottom) }}
        >
          <View className="items-center">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>
          {children}
        </View>
      </Animated.View>
    </Overlay>
  );
}
