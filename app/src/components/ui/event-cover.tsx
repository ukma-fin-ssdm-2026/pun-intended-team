// Written with the help of Claude
import { Image, type ImageSource } from 'expo-image';
import { useState, type ReactNode } from 'react';

import type { ApiEventPhoto } from '@/api/images';
import { ApiPicture } from '@/components/pictures/picture';
import { CoralGradient } from '@/components/ui/coral-gradient';

type Props = {
  // A bundled image, or an imported event's `imageUrl` (see `coverOf`); without one, the coral gradient.
  cover?: ImageSource | number;
  // The cover an organization uploaded; it wins over `cover`.
  photo?: ApiEventPhoto | null;
  gradient?: 'cover' | 'thumb';
  // Drawn instead of the gradient preset, e.g. a collage tile's own gradient.
  fallback?: ReactNode;
};

// An imported event's cover, linked from the provider: the server never copies or resizes it (ADR-006, decisions 6
// and 9), so the app keeps what it loaded in memory and on disk instead of asking the provider again.
export function coverOf(imageUrl: string | null | undefined): ImageSource | undefined {
  return imageUrl ? { uri: imageUrl } : undefined;
}

// An event's cover image filling its frame. One that fails to load, e.g. removed by the provider, shows the gradient,
// as an event without one does.
export function EventCover({ cover, photo, gradient = 'cover', fallback }: Props) {
  // A bundled image is a module number, a linked one is known by its URL.
  const id = typeof cover === 'object' ? cover.uri : cover;
  const [failed, setFailed] = useState<string | number>();

  if (photo) {
    return (
      <>
        {fallback ?? <CoralGradient preset={gradient} />}
        <ApiPicture image={photo} />
      </>
    );
  }
  if (!cover || failed === id) {
    return fallback ?? <CoralGradient preset={gradient} />;
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
