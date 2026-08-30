import * as Location from 'expo-location';

export interface LatLng {
  latitude: number;
  longitude: number;
}

// Default fallback: Cairo center
export const DEFAULT_LOCATION: LatLng = {
  latitude: 30.0444,
  longitude: 31.2357,
};

/**
 * Request location permission and return current position.
 * Returns null if permission denied or error occurs.
 */
export async function requestLocationPermission(): Promise<'granted' | 'denied'> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * Get the current device location.
 * Falls back to DEFAULT_LOCATION if unavailable.
 */
export async function getCurrentLocation(): Promise<LatLng> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const granted = await requestLocationPermission();
      if (granted !== 'granted') return DEFAULT_LOCATION;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch {
    return DEFAULT_LOCATION;
  }
}

/**
 * Watch location updates continuously.
 * Returns a subscription that must be removed when done.
 */
export async function watchLocation(
  callback: (location: LatLng) => void,
  onError?: () => void
): Promise<Location.LocationSubscription | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (loc) => {
        callback({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    );
    return sub;
  } catch {
    onError?.();
    return null;
  }
}

/**
 * Calculate distance between two coordinates in km.
 */
export function getDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sin1 * sin1 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * sin2 * sin2),
      Math.sqrt(1 - sin1 * sin1 - Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * sin2 * sin2)
    );
  return R * c;
}

/**
 * Format distance for display (meters / km).
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} م`;
  return `${km.toFixed(1)} كم`;
}
