// Written with the help of Claude
// AI Usage: event card skeleton from the Figma "01.1 Каталог · завантаження" screen; reviewed by Daryna Halytska.
import { View } from 'react-native';

import { Glass } from '@/components/ui/glass';
import { shadows } from '@/styles/tokens';

// The same frame as EventCard, with grey bars where the cover, title, date and place go.
export function EventCardSkeleton() {
  return (
    <View
      accessibilityLabel="Завантаження події"
      className="gap-1 rounded-[22px] bg-surface-card px-2 pb-3.5 pt-2"
      style={{ boxShadow: shadows.small }}
    >
      <View className="h-[170px] overflow-hidden rounded-2xl bg-border-default">
        <Glass
          className="absolute left-2.5 top-2.5 h-[18px] w-[58px]"
          radius={12}
          fill="rgba(18, 18, 18, 0.45)"
          tone="dark"
        />
        <Glass
          className="absolute right-2.5 top-2.5 size-9"
          radius={18}
          fill="rgba(255, 255, 255, 0.28)"
          border="rgba(255, 255, 255, 0.4)"
          tone="light"
        />
      </View>
      <View className="gap-3.5 px-2 pt-3">
        <View className="gap-2">
          <View className="h-3 w-[254px] max-w-full rounded-md bg-border-default" />
          <View className="flex-row gap-4">
            <View className="h-[11px] w-24 rounded-md bg-border-default" />
            <View className="h-[11px] w-[50px] rounded-md bg-border-default" />
          </View>
        </View>
        <View className="h-8" />
      </View>
    </View>
  );
}
