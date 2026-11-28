// Written with the help of Claude
// The venue map on Android and iOS: react-native-maps, with Google Maps on Android (its key is in the EAS environment,
// external-services.md) and Apple Maps on iOS. The web build uses venue-map.web.tsx.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { clampToKyiv, isInKyiv, KYIV_CENTER, type MapPoint } from './kyiv';
import { mapTargets, VENUE_CARD_HEIGHT, type VenueMapProps, type VenuePin } from './venue-map-props';
import { VenuePinView } from './venue-pin';

// The whole city, so every pin is on screen; a closer view around the user.
const CITY_DELTA = 0.32;
const USER_DELTA = 0.04;
// A venue opened from its event page: a few streets around it.
const FOCUS_DELTA = 0.012;

// Google Maps on Android draws a marker once, as an image of its view. A marker that tracked its view all the time
// would be redrawn on every frame, so it tracks it only for this long after it is made, which is enough for the number
// to be laid out and drawn.
export const TRACK_PIN_VIEW_MS = 500;

const regionAround = ({ lat, lng }: MapPoint, delta: number): Region => ({
  latitude: lat,
  longitude: lng,
  latitudeDelta: delta,
  longitudeDelta: delta,
});

function VenueMarker({ pin, selected, onPress }: { pin: VenuePin; selected: boolean; onPress: () => void }) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), TRACK_PIN_VIEW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: pin.location.lat, longitude: pin.location.lng }}
      onPress={onPress}
      tracksViewChanges={tracking}
      accessibilityLabel={pin.name}
      zIndex={selected ? 1 : 0}
    >
      <VenuePinView count={pin.count} selected={selected} />
    </Marker>
  );
}

export function VenueMap({ pins, selectedId, user, focused, onPinPress }: VenueMapProps) {
  const map = useRef<MapView>(null);

  const { selectedLat, selectedLng, userLat, userLng } = mapTargets({ pins, selectedId, user });
  const focusedRef = useRef(focused);
  useEffect(() => {
    focusedRef.current = focused;
  });

  // The location arrives after the map is shown; the map moves to it once, if it is in the city, unless it shows a
  // venue opened from its event page.
  useEffect(() => {
    if (userLat === undefined || userLng === undefined || focusedRef.current) return;
    map.current?.animateToRegion(regionAround({ lat: userLat, lng: userLng }, USER_DELTA), 400);
  }, [userLat, userLng]);

  // A selected pin moves above the venue card; a focused one is also zoomed in on.
  useEffect(() => {
    if (selectedLat === undefined || selectedLng === undefined) return;
    if (focused) {
      map.current?.animateToRegion(regionAround({ lat: selectedLat, lng: selectedLng }, FOCUS_DELTA), 400);
      return;
    }
    map.current?.animateCamera({ center: { latitude: selectedLat, longitude: selectedLng } }, { duration: 300 });
  }, [selectedLat, selectedLng, focused]);

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
          <VenueMarker
            // A new number or selection makes a new marker, which draws its view again.
            key={`${pin.id}:${pin.count}:${selected}`}
            pin={pin}
            selected={selected}
            onPress={() => onPinPress(pin.id)}
          />
        );
      })}
    </MapView>
  );
}
