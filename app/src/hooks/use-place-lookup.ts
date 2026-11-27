// Written with the help of Claude
import { useEffect, useRef, useState } from 'react';

import { describePlace, type PlaceDescription } from '@/api/places';
import type { MapPoint } from '@/components/map/kyiv';

// The map is asked about its centre once it has rested this long, so a drag does not send a request per stop.
export const LOOKUP_DELAY_MS = 600;

export type PlaceLookup =
  | { status: 'idle' | 'loading' | 'not-found' | 'unavailable'; place?: undefined }
  | { status: 'found'; place: PlaceDescription };

const IDLE: PlaceLookup = { status: 'idle' };
const LOADING: PlaceLookup = { status: 'loading' };

/** What is at `point`, looked up once the point has stayed the same for a moment; idle without a point. */
export function usePlaceLookup(point: MapPoint | undefined): PlaceLookup {
  // The answer for a point; while the latest point has none, the lookup is loading.
  const [answer, setAnswer] = useState<{ point: MapPoint; lookup: PlaceLookup }>();
  // Only the answer for the latest point is kept.
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    if (!point) return;
    const timer = setTimeout(() => {
      void describePlace(point).then((result) => {
        if (request !== latest.current) return;
        const lookup: PlaceLookup = result.ok
          ? { status: 'found', place: result.data }
          : { status: result.status === 404 ? 'not-found' : 'unavailable' };
        setAnswer({ point, lookup });
      });
    }, LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [point]);

  if (!point) return IDLE;
  return answer?.point === point ? answer.lookup : LOADING;
}
