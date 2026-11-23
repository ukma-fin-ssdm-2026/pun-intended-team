// Written with the help of Claude
// The map an organization places a new venue on, on Android and iOS; the web build uses point-picker-map.web.tsx. The
// pin stays in the middle of the screen and the map moves under it, as in Д2.1.
import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { clampToKyiv, isInKyiv, KYIV_CENTER, type MapPoint } from './kyiv';

// About the streets around one building.
const STREET_DELTA = 0.01;

export type PointPickerMapProps = {
  /** Where the map starts; the city centre without it. */
  initial?: MapPoint;
  /** The point under the pin, each time the map stops moving. */
  onMove: (center: MapPoint) => void;
};

export function PointPickerMap({ initial = KYIV_CENTER, onMove }: PointPickerMapProps) {
  const map = useRef<MapView>(null);

  // A map moved away from the city comes back to its edge, and only a point in the city is reported.
  const settle = ({ latitude, longitude, latitudeDelta, longitudeDelta }: Region) => {
    const center = { lat: latitude, lng: longitude };
    if (isInKyiv(center)) {
      onMove(center);
      return;
    }
    const { lat, lng } = clampToKyiv(center);
    map.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta, longitudeDelta }, 200);
  };

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: initial.lat,
        longitude: initial.lng,
        latitudeDelta: STREET_DELTA,
        longitudeDelta: STREET_DELTA,
      }}
      minZoomLevel={10}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onRegionChangeComplete={settle}
    />
  );
}
