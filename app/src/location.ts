// Written with the help of Claude
import * as Location from 'expo-location';

import type { Point } from '@/state/catalog-filters';

export type LocateResult = { status: 'located'; point: Point } | { status: 'denied' } | { status: 'failed' };

// Asks for the permission only when called: when the user turns "Поруч зі мною" on, never at start.
export async function locateUser(): Promise<LocateResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { status: 'denied' };
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { status: 'located', point: { lat: coords.latitude, lng: coords.longitude } };
  } catch {
    return { status: 'failed' };
  }
}
