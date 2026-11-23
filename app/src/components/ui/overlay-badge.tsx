// Written with the help of Claude
// AI Usage: the dark glass badge over an event cover; reviewed by Daryna Halytska and Oleh Moshenskyi.
import type { ReactNode, RefObject } from 'react';
import { Text, type View } from 'react-native';

import { Glass } from '@/components/ui/glass';

// The surface every badge over an event cover shares: the category and the heart of the event card, and the price on
// the event page. Dark glass, 36 px high, fully rounded, with white content, so it shows on a white cover and a dark
// one. Position, width and padding come from `className`; Android blurs only `blurTarget`, the cover's BlurTargetView.
export function OverlayBadge({
  className,
  blurTarget,
  children,
}: {
  className?: string;
  blurTarget?: RefObject<View | null>;
  children?: ReactNode;
}) {
  return (
    <Glass
      className={`h-9 flex-row items-center justify-center ${className ?? ''}`}
      radius={18}
      fill="rgba(18, 18, 18, 0.45)"
      tone="dark"
      blurTarget={blurTarget}
    >
      {children}
    </Glass>
  );
}

// "1.3 Ціна" on the event page: the price, already formatted by `priceLabel`, e.g. "450 ₴".
export function PriceBadge({
  price,
  className,
  blurTarget,
}: {
  price: string;
  className?: string;
  blurTarget?: RefObject<View | null>;
}) {
  return (
    <OverlayBadge className={`px-3.5 ${className ?? ''}`} blurTarget={blurTarget}>
      <Text numberOfLines={1} className="font-inter-semibold text-price tracking-[-0.14px] text-text-on-dark">
        {price}
      </Text>
    </OverlayBadge>
  );
}
