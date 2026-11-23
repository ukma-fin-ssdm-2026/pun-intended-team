// Written with the help of Claude
// AI Usage: event collage of the Figma "В1 Онбординг · Події" frame; reviewed by Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { components } from '@/api/schema';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { coverOf, EventCover } from '@/components/ui/event-cover';
import { useEvents } from '@/hooks/use-events';

type Event = components['schemas']['Event'];

const jazz: ImageSource = require('@/assets/images/events/jazz-evening.png');
const kvartyrnyk: ImageSource = require('@/assets/images/events/kvartyrnyk.png');

const TILE_WIDTH = 122;
// Three columns 10 px apart; Figma centres them in the 390 px frame (left 2, 134, 266).
const COLUMN_STEP = 132;
const COLLAGE_WIDTH = TILE_WIDTH * 3 + 20;

// The gradient tiles scale the coral gradient to their height; Figma's transforms for each height.
const gradientTransforms: Record<number, string> = {
  140: 'matrix(14.546 22.168 -13.026 24.828 3.3794 -10.276)',
  150: 'matrix(14.546 23.751 -13.026 26.601 3.3794 -11.01)',
  160: 'matrix(14.546 25.334 -13.026 28.374 3.3794 -11.744)',
  170: 'matrix(14.546 26.918 -13.026 30.148 3.3794 -12.478)',
};

// `eventId` marks a tile showing a catalog event instead of the bundled picture.
type Tile = { column: number; top: number; height: number; image?: ImageSource; eventId?: string };

// "00 Колаж подій": three columns of 122 px tiles, partly above and below the 600 px frame; the tiles have no titles.
const tiles: Tile[] = [
  { column: 0, top: -60, height: 170, image: jazz },
  { column: 0, top: 120, height: 150 },
  { column: 0, top: 280, height: 190, image: kvartyrnyk },
  { column: 0, top: 480, height: 160 },
  { column: 1, top: 10, height: 140 },
  { column: 1, top: 160, height: 200, image: kvartyrnyk },
  { column: 1, top: 370, height: 170, image: jazz },
  { column: 1, top: 550, height: 150 },
  { column: 2, top: -110, height: 180, image: kvartyrnyk },
  { column: 2, top: 80, height: 160, image: jazz },
  { column: 2, top: 250, height: 170 },
  { column: 2, top: 430, height: 150, image: kvartyrnyk },
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

// The catalog's events fill the tiles in order, those with an image first. While they load, when the catalog cannot be
// reached, or for the tiles left over, the bundled pictures and gradients stay, so the screen is never empty.
function withEvents(events: Event[] | undefined): Tile[] {
  const picked = [...(events ?? [])].sort((a, b) => Number(!a.imageUrl) - Number(!b.imageUrl));
  return tiles.map((tile, index) => {
    const event = picked[index];
    return event ? { ...tile, image: coverOf(event.imageUrl), eventId: event.id } : tile;
  });
}

export function EventsCollage() {
  const { width } = useWindowDimensions();
  const { data } = useEvents();
  const start = (width - COLLAGE_WIDTH) / 2;
  return (
    <View className="absolute left-0 top-0 h-[600px] w-full overflow-hidden" style={{ pointerEvents: 'none' }}>
      {withEvents(data).map((tile, index) => {
        const gradient = (
          <CoralGradient
            frame={{ width: TILE_WIDTH, height: tile.height, transform: gradientTransforms[tile.height] }}
          />
        );
        return (
          <View
            key={tile.eventId ?? `${tile.column}-${tile.top}`}
            testID={tile.eventId && `collage-event-${tile.eventId}`}
            className="absolute overflow-hidden rounded-[20px]"
            style={{ left: start + tile.column * COLUMN_STEP, top: tile.top, width: TILE_WIDTH, height: tile.height }}
          >
            {/* An event's linked image falls back to the tile's gradient when it fails to load. */}
            {tile.eventId ? (
              <EventCover cover={tile.image} fallback={gradient} />
            ) : tile.image ? (
              <Image source={tile.image} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              gradient
            )}
            <TileShade id={`collage-shade-${index}`} />
          </View>
        );
      })}
    </View>
  );
}
