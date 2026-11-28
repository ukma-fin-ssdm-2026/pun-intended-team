// Written with the help of Claude
// AI Usage: the frame of the Figma DВ5–DВ8 desktop sign-up screens: the coral gradient, the logotype and a centered
// white card; reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { CoralGradient } from '@/components/ui/coral-gradient';
import { desktop, shadows } from '@/styles/tokens';

// "Картка форми" of DВ5–DВ8.
const CARD_WIDTH = 520;

export function DesktopAuthFrame({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 bg-brand-ink">
      <View className="absolute inset-0">
        <CoralGradient preset="screen" />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingBottom: 48 }}
      >
        <View className="w-full flex-row items-center px-12" style={{ height: desktop.headerHeight }}>
          <Text className="font-logo text-logo text-text-on-dark">Nearby</Text>
        </View>
        <View
          className="max-w-full overflow-hidden rounded-[28px] bg-surface-card"
          style={{ width: CARD_WIDTH, boxShadow: shadows.medium }}
        >
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
