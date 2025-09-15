import * as Location from 'expo-location';

export async function requestForegroundLocation(): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');
}

export async function getCurrentLocation() {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const a = res?.[0];
    if (!a) return null;
    return {
      street: a.street || a.name || null,
      city: a.city || a.subregion || a.region || null,
      country: a.country || null,
    };
  } catch {
    return null;
  }
}

export function formatAddress(addr?: { street?: string | null; city?: string | null } | null) {
  if (!addr) return null;
  const parts = [addr.street, addr.city].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}