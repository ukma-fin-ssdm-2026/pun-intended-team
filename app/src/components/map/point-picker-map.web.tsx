// Written with the help of Claude
// The map an organization places a new venue on, in the web build: MapLibre GL JS with OpenFreeMap's tiles, as the
// venue map. Android and iOS use point-picker-map.tsx.
import 'maplibre-gl/dist/maplibre-gl.css';

import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { KYIV_BOUNDS, KYIV_CENTER } from './kyiv';
import type { PointPickerMapProps } from './point-picker-map';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const STREET_ZOOM = 16;

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export function PointPickerMap({ initial = KYIV_CENTER, onMove }: PointPickerMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  });

  useEffect(() => {
    if (!container.current) return;
    const created = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: [initial.lng, initial.lat],
      zoom: STREET_ZOOM,
      maxBounds: [
        [KYIV_BOUNDS.west, KYIV_BOUNDS.south],
        [KYIV_BOUNDS.east, KYIV_BOUNDS.north],
      ],
    });
    created.on('moveend', () => {
      const { lat, lng } = created.getCenter();
      onMoveRef.current({ lat, lng });
    });
    return () => created.remove();
    // The map starts at `initial` once; later values would only jump it away from where the user moved it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
