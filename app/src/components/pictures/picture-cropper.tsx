// Written with the help of Claude
// Not in Figma: the crop preview the photo, cover and post photo buttons open.
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { aspectRatios, type PictureKind } from '@/pictures/geometry';
import { pickPicture, type PickedPicture, type PictureDraft } from '@/pictures/picked-picture';

const titles: Record<PictureKind, string> = {
  profilePhoto: 'Фото профілю',
  profileCover: 'Обкладинка',
  listingPhoto: 'Фото до допису',
};

const SIDE = 20;
const MAX_FRAME_WIDTH = 560;
const MAX_ZOOM = 5;
// The backdrop of the Overlay.
const SHADE = 'rgba(18, 18, 18, 0.6)';

type Props = {
  kind: PictureKind;
  // Shown while set: the picture just taken from the gallery.
  picture: PickedPicture | undefined;
  onCancel: () => void;
  onDone: (draft: PictureDraft) => void;
};

export function PictureCropper({ kind, picture, onCancel, onDone }: Props) {
  return (
    <Modal visible={!!picture} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      {/* A Modal is a window of its own on Android, so gestures need a root there too. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {picture && <CropView key={picture.uri} kind={kind} picture={picture} onCancel={onCancel} onDone={onDone} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

function CropView({ kind, picture, onCancel, onDone }: Omit<Props, 'picture'> & { picture: PickedPicture }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const frameWidth = Math.min(window.width - 2 * SIDE, MAX_FRAME_WIDTH);
  const frameHeight = frameWidth / aspectRatios[kind];
  // At zoom 1 the picture just covers the frame.
  const base = Math.max(frameWidth / picture.width, frameHeight / picture.height);
  const baseWidth = picture.width * base;
  const baseHeight = picture.height * base;

  const zoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const start = useSharedValue({ zoom: 1, x: 0, y: 0 });

  // How far the picture may move each way at this zoom and still cover the frame.
  const limit = (value: number, scale: number, shown: number, frame: number) => {
    'worklet';
    const max = Math.max(0, (shown * scale - frame) / 2);
    return Math.min(Math.max(value, -max), max);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = { zoom: zoom.value, x: x.value, y: y.value };
    })
    .onUpdate((event) => {
      x.value = limit(start.value.x + event.translationX, zoom.value, baseWidth, frameWidth);
      y.value = limit(start.value.y + event.translationY, zoom.value, baseHeight, frameHeight);
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { zoom: zoom.value, x: x.value, y: y.value };
    })
    .onUpdate((event) => {
      const scale = Math.min(Math.max(start.value.zoom * event.scale, 1), MAX_ZOOM);
      zoom.value = scale;
      x.value = limit(x.value, scale, baseWidth, frameWidth);
      y.value = limit(y.value, scale, baseHeight, frameHeight);
    });
  // Without two fingers, e.g. with a mouse, a double tap zooms in and out.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const scale = zoom.value > 1.01 ? 1 : 2;
      zoom.value = withTiming(scale);
      x.value = withTiming(limit(x.value, scale, baseWidth, frameWidth));
      y.value = withTiming(limit(y.value, scale, baseHeight, frameHeight));
    });
  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const pictureStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }],
  }));

  const done = () => {
    const shownWidth = baseWidth * zoom.get();
    const shownHeight = baseHeight * zoom.get();
    const toPicture = picture.width / shownWidth;
    onDone({
      picture,
      crop: {
        left: ((shownWidth - frameWidth) / 2 - x.get()) * toPicture,
        top: ((shownHeight - frameHeight) / 2 - y.get()) * toPicture,
        width: frameWidth * toPicture,
        height: frameHeight * toPicture,
      },
    });
  };

  const frameLeft = (window.width - frameWidth) / 2;
  const frameTop = (window.height - frameHeight) / 2;

  return (
    <View className="flex-1 bg-brand-ink">
      <GestureDetector gesture={gesture}>
        <View className="absolute inset-0">
          <View className="absolute" style={{ left: frameLeft, top: frameTop, width: frameWidth, height: frameHeight }}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: (frameWidth - baseWidth) / 2,
                  top: (frameHeight - baseHeight) / 2,
                  width: baseWidth,
                  height: baseHeight,
                },
                pictureStyle,
              ]}
            >
              <Image source={{ uri: picture.uri }} contentFit="fill" style={{ width: '100%', height: '100%' }} />
            </Animated.View>
          </View>
          <Svg width={window.width} height={window.height} style={{ position: 'absolute', pointerEvents: 'none' }}>
            <Path
              d={`M0 0H${window.width}V${window.height}H0Z ${hole(kind, frameLeft, frameTop, frameWidth, frameHeight)}`}
              fill={SHADE}
              fillRule="evenodd"
            />
            <Path
              d={hole(kind, frameLeft, frameTop, frameWidth, frameHeight)}
              fill="none"
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth={1}
            />
          </Svg>
        </View>
      </GestureDetector>

      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-5"
        style={{ top: insets.top + 12 }}
      >
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}>
          <Text className="font-inter-semibold text-label text-text-on-dark">Скасувати</Text>
        </Pressable>
        <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-on-dark">
          {titles[kind]}
        </Text>
        <Pressable accessibilityRole="button" onPress={done} hitSlop={8}>
          <Text className="font-inter-semibold text-label text-brand-coral">Готово</Text>
        </Pressable>
      </View>
      <Text
        className="absolute left-0 right-0 px-5 text-center font-inter text-caption text-text-on-dark-muted"
        style={{ bottom: insets.bottom + 32, pointerEvents: 'none' }}
      >
        Посунь і збільш фото, щоб обрати, що буде видно
      </Text>
    </View>
  );
}

// The frame's outline: a circle for the avatar, a rectangle for the cover and a post photo.
function hole(kind: PictureKind, left: number, top: number, width: number, height: number): string {
  if (kind === 'profilePhoto') {
    const r = width / 2;
    return `M${left} ${top + r}a${r} ${r} 0 1 0 ${width} 0a${r} ${r} 0 1 0 ${-width} 0Z`;
  }
  return `M${left} ${top}H${left + width}V${top + height}H${left}Z`;
}

/** Gallery, then the crop preview: `start(kind)` opens them, `cropper` goes into the screen's tree. */
export function usePictureCropper(onCropped: (kind: PictureKind, draft: PictureDraft) => void) {
  const [cropping, setCropping] = useState<{ kind: PictureKind; picture: PickedPicture }>();

  const start = async (kind: PictureKind) => {
    const picture = await pickPicture();
    if (picture) setCropping({ kind, picture });
  };

  const cropper = (
    <PictureCropper
      kind={cropping?.kind ?? 'profilePhoto'}
      picture={cropping?.picture}
      onCancel={() => setCropping(undefined)}
      onDone={(draft) => {
        if (cropping) onCropped(cropping.kind, draft);
        setCropping(undefined);
      }}
    />
  );
  return { start, cropper };
}
