// Written with the help of Claude
// AI Usage: static map drawing shared by the Figma "Т1 Мапа" and "Д2.1 Місце на мапі" frames; reviewed by Daryna
// Halytska.
import { Text, View } from 'react-native';

import { mapPins, mapShapes, mapYouAreHere } from '@/mocks/map';

// Figma DROP_SHADOW values (radius as the CSS blur).
const PIN_SHADOW = '0px 4px 10px rgba(0, 0, 0, 0.2)';
// "Ви тут": the location blue with its 10 px halo at 25%.
const LOCATION_BLUE = '#2E5CD4';
const LOCATION_HALO = 'rgba(46, 92, 212, 0.25)';
// The map's search icon is #1A1A2E in Figma.
export const MAP_SEARCH_ICON = '#1A1A2E';

type Props = {
  // Т1 shows the venues with their event counts; Д2.1 shows only the streets and "Ви тут".
  venuePins?: boolean;
};

export function MapBackground({ venuePins = false }: Props) {
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
      {venuePins &&
        mapPins.map((pin, index) => (
          <View
            key={index}
            className={`absolute items-center justify-center border-[3px] border-white ${pin.selected ? 'bg-brand-coral' : 'bg-brand-ink'}`}
            style={{
              left: pin.left,
              top: pin.top,
              width: pin.size,
              height: pin.size,
              borderRadius: pin.size / 2,
              boxShadow: PIN_SHADOW,
            }}
          >
            <Text className="font-inter-medium text-label text-text-on-dark">{pin.count}</Text>
          </View>
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
