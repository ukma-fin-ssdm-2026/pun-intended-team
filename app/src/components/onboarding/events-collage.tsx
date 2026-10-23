// Written with the help of Claude
// AI Usage: event collage of the Figma "В1 Онбординг · Події" frame; reviewed by Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CoralGradient } from '@/components/ui/coral-gradient';

const jazz: ImageSource = require('@/assets/images/events/jazz-evening.png');
const kvartyrnyk: ImageSource = require('@/assets/images/events/kvartyrnyk.png');

const TILE_WIDTH = 122;

// The gradient tiles scale the coral gradient to their height; Figma's transforms for each height.
const gradientTransforms: Record<number, string> = {
  140: 'matrix(14.546 22.168 -13.026 24.828 3.3794 -10.276)',
  150: 'matrix(14.546 23.751 -13.026 26.601 3.3794 -11.01)',
  160: 'matrix(14.546 25.334 -13.026 28.374 3.3794 -11.744)',
  170: 'matrix(14.546 26.918 -13.026 30.148 3.3794 -12.478)',
};

type Tile = { label: string; left: number; top: number; height: number; image?: ImageSource };

// "00 Колаж подій": three columns of 122 px tiles, partly outside the 390 × 600 frame.
const tiles: Tile[] = [
  { label: 'Джаз-вечір', left: -12, top: -60, height: 170, image: jazz },
  { label: 'Лекція: сучасне мистецтво', left: -12, top: 120, height: 150 },
  { label: 'Квартирник', left: -12, top: 280, height: 190, image: kvartyrnyk },
  { label: 'Кіно під зірками', left: -12, top: 480, height: 160 },
  { label: 'Стендап у Подолі', left: 120, top: 10, height: 140 },
  { label: 'Вечірка на даху', left: 120, top: 160, height: 200, image: kvartyrnyk },
  { label: 'Виставка ілюстрації', left: 120, top: 370, height: 170, image: jazz },
  { label: 'Кераміка', left: 120, top: 550, height: 150 },
  { label: 'Поетичний вечір', left: 252, top: -110, height: 180, image: kvartyrnyk },
  { label: 'Інді-концерт', left: 252, top: 80, height: 160, image: jazz },
  { label: 'Настільні ігри', left: 252, top: 250, height: 170 },
  { label: 'Фестиваль', left: 252, top: 430, height: 150, image: kvartyrnyk },
];

// "Затемнення": clear down to 45% of the tile, then black at 55% at the bottom.
function TileShade({ id }: { id: string }) {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0.45} stopColor="#000" stopOpacity={0} />
          <Stop offset={1} stopColor="#000" stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function EventsCollage() {
  return (
    <View className="absolute left-0 top-0 h-[600px] w-full overflow-hidden" style={{ pointerEvents: 'none' }}>
      {tiles.map((tile, index) => (
        <View
          key={tile.label}
          className="absolute overflow-hidden rounded-[20px]"
          style={{ left: tile.left, top: tile.top, width: TILE_WIDTH, height: tile.height }}
        >
          {tile.image ? (
            <Image source={tile.image} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CoralGradient
              frame={{ width: TILE_WIDTH, height: tile.height, transform: gradientTransforms[tile.height] }}
            />
          )}
          <TileShade id={`collage-shade-${index}`} />
          <Text className="absolute bottom-3 left-3 w-[100px] font-inter-semibold text-tag text-white">
            {tile.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
