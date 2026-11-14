// Written with the help of Claude
// AI Usage: static map drawing from the Figma "Д2.1 Місце на мапі" frame; reviewed by Daryna Halytska. The venue map of
// Т1 is a real map (components/map/).
import { View } from 'react-native';

// "00 Мапа" in frame coordinates (390 × 844): each shape by its bounding box in Figma, its own size and rotation.
type Shape = {
  left: number;
  top: number;
  boxWidth: number;
  boxHeight: number;
  width: number;
  height: number;
  rotate: number;
  color: string;
  radius?: number;
};

const mapShapes: Shape[] = [
  // Парк
  {
    left: 210,
    top: 400,
    boxWidth: 150,
    boxHeight: 130,
    width: 150,
    height: 130,
    rotate: 0,
    color: '#DBE5D6',
    radius: 30,
  },
  // Дніпро
  {
    left: 193.61,
    top: -60,
    boxWidth: 255.222,
    boxHeight: 987.164,
    width: 120,
    height: 980,
    rotate: 8,
    color: '#D1DEE5',
  },
  // Проспект
  { left: -20, top: 250, boxWidth: 440, boxHeight: 14, width: 440, height: 14, rotate: 0, color: '#FFFFFF' },
  // Вулиці
  {
    left: -20,
    top: 474.01,
    boxWidth: 438.635,
    boxHeight: 55.938,
    width: 440,
    height: 10,
    rotate: -6,
    color: '#FFFFFF',
  },
  { left: 120, top: -20, boxWidth: 12, boxHeight: 900, width: 12, height: 900, rotate: 0, color: '#FFFFFF' },
  { left: 177.22, top: -20, boxWidth: 72.756, boxHeight: 898.505, width: 10, height: 900, rotate: 4, color: '#FFFFFF' },
  { left: -21.39, top: 380, boxWidth: 434.705, boxHeight: 84.284, width: 440, height: 8, rotate: 10, color: '#FFFFFF' },
  { left: 40, top: -21.11, boxWidth: 133.178, boxHeight: 892.355, width: 8, height: 900, rotate: -8, color: '#FFFFFF' },
];

// "Ви тут": an 18 px dot at (150, 410).
const mapYouAreHere = { left: 150, top: 410 };

// "Ви тут": the location blue with its 10 px halo at 25%.
const LOCATION_BLUE = '#2E5CD4';
const LOCATION_HALO = 'rgba(46, 92, 212, 0.25)';
// The map's search icon is #1A1A2E in Figma.
export const MAP_SEARCH_ICON = '#1A1A2E';

export function MapBackground() {
  return (
    <View className="absolute inset-0 overflow-hidden bg-[#ECECE7]" style={{ pointerEvents: 'none' }}>
      {mapShapes.map((shape, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            // Rotated around its centre, which stays at the centre of Figma's bounding box.
            left: shape.left + (shape.boxWidth - shape.width) / 2,
            top: shape.top + (shape.boxHeight - shape.height) / 2,
            width: shape.width,
            height: shape.height,
            borderRadius: shape.radius,
            backgroundColor: shape.color,
            transform: [{ rotate: `${shape.rotate}deg` }],
          }}
        />
      ))}
      <View
        className="absolute size-[38px] items-center justify-center rounded-full"
        style={{ left: mapYouAreHere.left - 10, top: mapYouAreHere.top - 10, backgroundColor: LOCATION_HALO }}
      >
        <View
          className="size-[18px] rounded-full border-[3px] border-white"
          style={{ backgroundColor: LOCATION_BLUE }}
        />
      </View>
    </View>
  );
}
