// Written with the help of Claude
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';

import { CoralGradient } from '@/components/ui/coral-gradient';

type Props = {
  // A bundled image, or an imported event's `imageUrl` (see `coverOf`); without one, the coral gradient.
  cover?: ImageSource | number;
  gradient?: 'cover' | 'thumb';
};

// An imported event's cover, linked from the provider: the server never copies or resizes it (ADR-006, decisions 6
// and 9), so the app keeps what it loaded in memory and on disk instead of asking the provider again.
export function coverOf(imageUrl: string | null | undefined): ImageSource | undefined {
  return imageUrl ? { uri: imageUrl } : undefined;
}

// An event's cover image filling its frame. One that fails to load, e.g. removed by the provider, shows the gradient,
// as an event without one does.
export function EventCover({ cover, gradient = 'cover' }: Props) {
  // A bundled image is a module number, a linked one is known by its URL.
  const id = typeof cover === 'object' ? cover.uri : cover;
  const [failed, setFailed] = useState<string | number>();

  if (!cover || failed === id) {
    return <CoralGradient preset={gradient} />;
  }
  return (
    <Image
      source={cover}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(id)}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
