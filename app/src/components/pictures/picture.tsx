// Written with the help of Claude
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import type { ApiCoverImage, ApiImage } from '@/api/images';
import { useImageSource } from '@/hooks/use-image-source';
import { visibleArea, wholeArea, type Area, type Size } from '@/pictures/geometry';

type Props = {
  source: ImageSource | undefined;
  // The picture's size and the area to show, in its pixels; without `crop`, all of it.
  size: Size;
  crop?: Area;
};

// Fills its parent, which sets the size and the corners. A parent of another shape than the crop shows more of the
// picture around it (geometry.ts).
export function Picture({ source, size, crop }: Props) {
  const [box, setBox] = useState<Size>();
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) =>
    setBox({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });

  let placement: { left: number; top: number; width: number; height: number } | undefined;
  if (box && box.width > 0 && box.height > 0) {
    const area = visibleArea(size, crop ?? wholeArea(size), box.width / box.height);
    const scale = box.width / area.width;
    placement = {
      left: -area.left * scale,
      top: -area.top * scale,
      width: size.width * scale,
      height: size.height * scale,
    };
  }

  // Until the parent is measured, the picture covers it around its centre, so the first frame is not empty. Pictures
  // stay in memory, so going back to a screen shows them at once.
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none" onLayout={onLayout}>
      {source && (
        <Image
          source={source}
          contentFit={placement ? 'fill' : 'cover'}
          cachePolicy="memory-disk"
          style={{ position: 'absolute', ...(placement ?? { left: 0, top: 0, width: '100%', height: '100%' }) }}
        />
      )}
    </View>
  );
}

/** A picture stored by the API: a photo as it was cut, a cover around the area its owner picked. */
export function ApiPicture({ image }: { image: ApiImage | ApiCoverImage }) {
  const source = useImageSource(image.id);
  return <Picture source={source} size={image} crop={'crop' in image ? image.crop : undefined} />;
}
