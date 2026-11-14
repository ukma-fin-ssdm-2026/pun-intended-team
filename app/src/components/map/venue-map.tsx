// Written with the help of Claude
// The venue map on Android and iOS: react-native-maps, with Google Maps on Android (its key is in the EAS environment,
// external-services.md) and Apple Maps on iOS. The web build uses venue-map.web.tsx.
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { clampToKyiv, isInKyiv, KYIV_CENTER, type MapPoint } from './kyiv';
import { mapTargets, VENUE_CARD_HEIGHT, type VenueMapProps } from './venue-map-props';
import { VenuePinView } from './venue-pin';

// The whole city, so every pin is on screen; a closer view around the user.
const CITY_DELTA = 0.32;
const USER_DELTA = 0.04;

const regionAround = ({ lat, lng }: MapPoint, delta: number): Region => ({
  latitude: lat,
  longitude: lng,
  latitudeDelta: delta,
  longitudeDelta: delta,
});

export function VenueMap({ pins, selectedId, user, onPinPress }: VenueMapProps) {
  const map = useRef<MapView>(null);

  const { selectedLat, selectedLng, userLat, userLng } = mapTargets({ pins, selectedId, user });

  // The location arrives after the map is shown; the map moves to it once, if it is in the city.
  useEffect(() => {
    if (userLat === undefined || userLng === undefined) return;
    map.current?.animateToRegion(regionAround({ lat: userLat, lng: userLng }, USER_DELTA), 400);
  }, [userLat, userLng]);

  // A selected pin moves above the venue card.
  useEffect(() => {
    if (selectedLat === undefined || selectedLng === undefined) return;
    map.current?.animateCamera({ center: { latitude: selectedLat, longitude: selectedLng } }, { duration: 300 });
  }, [selectedLat, selectedLng]);

  // A map moved away from the city comes back to its edge.
  const keepInKyiv = ({ latitude, longitude, latitudeDelta, longitudeDelta }: Region) => {
    const center = { lat: latitude, lng: longitude };
    if (isInKyiv(center)) return;
    const { lat, lng } = clampToKyiv(center);
    map.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta, longitudeDelta }, 200);
  };

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={regionAround(KYIV_CENTER, CITY_DELTA)}
      minZoomLevel={10}
      mapPadding={{ top: 0, right: 0, left: 0, bottom: selectedId ? VENUE_CARD_HEIGHT : 0 }}
      showsUserLocation={!!user}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onRegionChangeComplete={keepInKyiv}
    >
      {pins.map((pin) => {
        const selected = pin.id === selectedId;
        return (
          <Marker
            // A new key redraws the marker when it is selected, since it does not track its view's changes.
            key={`${pin.id}:${selected}`}
            coordinate={{ latitude: pin.location.lat, longitude: pin.location.lng }}
            onPress={() => onPinPress(pin.id)}
            tracksViewChanges={false}
            accessibilityLabel={pin.name}
            zIndex={selected ? 1 : 0}
          >
            <VenuePinView count={pin.count} selected={selected} />
          </Marker>
        );
      })}
    </MapView>
  );
}
