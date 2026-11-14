// Written with the help of Claude
// The venue map in the web build: MapLibre GL JS with OpenFreeMap's vector tiles, which need no key
// (external-services.md). Android and iOS use venue-map.tsx.
import 'maplibre-gl/dist/maplibre-gl.css';

import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { colors } from '@/styles/tokens';

import { KYIV_BOUNDS, KYIV_CENTER } from './kyiv';
import { mapTargets, PIN_SIZE, SELECTED_PIN_SIZE, VENUE_CARD_HEIGHT, type VenueMapProps } from './venue-map-props';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const CITY_ZOOM = 10.5;
const USER_ZOOM = 13;
// "Ви тут" of Т1: the location blue with its 10 px halo at 25%.
const LOCATION_BLUE = '#2E5CD4';

/** A venue pin of Т1 as a DOM element: the number of events in an ink circle, coral when selected. */
function pinElement(name: string, count: number, selected: boolean, onPress: () => void): HTMLElement {
  const size = selected ? SELECTED_PIN_SIZE : PIN_SIZE;
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', name);
  element.textContent = String(count);
  Object.assign(element.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    border: '3px solid #FFFFFF',
    background: selected ? colors.brand.coral : colors.brand.ink,
    color: '#FFFFFF',
    font: '500 14px Inter, sans-serif',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
    cursor: 'pointer',
    zIndex: selected ? '1' : '0',
  });
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    onPress();
  });
  return element;
}

function userElement(): HTMLElement {
  const element = document.createElement('div');
  Object.assign(element.style, {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '3px solid #FFFFFF',
    background: LOCATION_BLUE,
    boxShadow: '0 0 0 10px rgba(46, 92, 212, 0.25)',
  });
  return element;
}

export function VenueMap({ pins, selectedId, user, onPinPress }: VenueMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const onPinPressRef = useRef(onPinPress);
  useEffect(() => {
    onPinPressRef.current = onPinPress;
  });

  useEffect(() => {
    if (!container.current) return;
    const created = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: [KYIV_CENTER.lng, KYIV_CENTER.lat],
      zoom: CITY_ZOOM,
      maxBounds: [
        [KYIV_BOUNDS.west, KYIV_BOUNDS.south],
        [KYIV_BOUNDS.east, KYIV_BOUNDS.north],
      ],
    });
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const markers = pins.map((pin) =>
      new Marker({
        element: pinElement(pin.name, pin.count, pin.id === selectedId, () => onPinPressRef.current(pin.id)),
      })
        .setLngLat([pin.location.lng, pin.location.lat])
        .addTo(current),
    );
    return () => markers.forEach((marker) => marker.remove());
  }, [pins, selectedId]);

  const { selectedLat, selectedLng, userLat, userLng } = mapTargets({ pins, selectedId, user });

  // A selected pin moves above the venue card.
  useEffect(() => {
    if (selectedLat === undefined || selectedLng === undefined) return;
    map.current?.easeTo({
      center: [selectedLng, selectedLat],
      padding: { top: 0, right: 0, left: 0, bottom: VENUE_CARD_HEIGHT },
    });
  }, [selectedLat, selectedLng]);

  // The location arrives after the map is shown; the map moves to it once, if it is in the city.
  useEffect(() => {
    const current = map.current;
    if (!current || userLat === undefined || userLng === undefined) return;
    const marker = new Marker({ element: userElement() }).setLngLat([userLng, userLat]).addTo(current);
    current.flyTo({ center: [userLng, userLat], zoom: USER_ZOOM });
    return () => {
      marker.remove();
    };
  }, [userLat, userLng]);

  return (
    <View
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      // react-native-web renders a div, which MapLibre draws into.
      ref={(node) => {
        container.current = node as unknown as HTMLDivElement | null;
      }}
    />
  );
}
