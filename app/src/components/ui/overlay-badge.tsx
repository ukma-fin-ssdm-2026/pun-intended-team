// Written with the help of Claude
// AI Usage: the white badge over an event cover from the Figma "Картка / Подія"; reviewed by Daryna Halytska.
import { Text, View, type ViewProps } from 'react-native';

import { shadows } from '@/styles/tokens';

// The surface every badge over an event cover shares: the category, the heart and the price of "Картка / Подія", and
// the price on the event page. White, 36 px high, fully rounded, with "Nearby/Shadow Small", so it shows on any cover.
// Position, width and padding come from `className`.
export function OverlayBadge({ className, style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      className={`h-9 flex-row items-center justify-center rounded-full bg-surface-card ${className ?? ''}`}
      style={[{ boxShadow: shadows.small }, style]}
    />
  );
}

// "1.3 Ціна": the price, already formatted by `priceLabel`, e.g. "450 ₴".
export function PriceBadge({ price, className }: { price: string; className?: string }) {
  return (
    <OverlayBadge className={`px-3.5 ${className ?? ''}`}>
      <Text numberOfLines={1} className="font-inter-semibold text-price tracking-[-0.14px] text-brand-coral">
        {price}
      </Text>
    </OverlayBadge>
  );
}
