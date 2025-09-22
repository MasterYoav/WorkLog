/**
 * Location utilities tests
 * Covers: haversineMeters (distance) + isWithinRadius/withinRadius (geofence)
 * We mock 'expo-location' so Jest won't parse RN TSX from node_modules.
 */

// 👇 IMPORTANT: mock BEFORE importing your module
jest.mock('expo-location', () => ({
    __esModule: true,
    // minimal stubs your code might call; safe defaults
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: { latitude: 0, longitude: 0, accuracy: 50 },
    })),
    reverseGeocodeAsync: jest.fn(async () => [{ street: 'רח׳ דן', city: 'אורנית' }]),
  }));
  
  import * as loc from '../src/lib/location';
  
  // small helper: approx compare (±%)
  function approx(received: number, expected: number, tolerancePct = 0.08) {
    const diff = Math.abs(received - expected);
    const tol = expected * tolerancePct;
    expect(diff).toBeLessThanOrEqual(tol);
  }
  
  describe('location.ts', () => {
    test('haversineMeters computes realistic distances', () => {
      // Your implementation uses 4 numeric args
      const { haversineMeters } = loc as {
        haversineMeters: (lat1: number, lng1: number, lat2: number, lng2: number) => number;
      };
  
      // Tel Aviv (Azrieli) → Jerusalem (Old City) ≈ 54 km (rough)
      const tlv = { lat: 32.074, lng: 34.791 };
      const jlm = { lat: 31.776, lng: 35.234 };
      const d1 = haversineMeters(tlv.lat, tlv.lng, jlm.lat, jlm.lng);
      approx(d1, 54000, 0.08);
  
      // Same point → ~0
      const d2 = haversineMeters(tlv.lat, tlv.lng, tlv.lat, tlv.lng);
      expect(d2).toBeLessThan(1);
    });
  
    test('isWithinRadius (or withinRadius) enforces 4km', () => {
      const fn =
        (loc as any).isWithinRadius ??
        (loc as any).withinRadius as
          | ((a: { lat: number; lng: number }, b: { lat: number; lng: number }, r: number) => boolean)
          | undefined;
  
      if (!fn) {
        // If you don’t export this helper, we just skip.
        console.warn('Skipping: isWithinRadius/withinRadius not exported from src/lib/location');
        return;
      }
  
      // Site near Oranit; near point within ~3–4km
      const site = { lat: 32.101, lng: 34.980 };
      const near = { lat: 32.085, lng: 34.950 };
      expect(fn(near, site, 4000)).toBe(true);
  
      // Far point (Tel Aviv)
      const far = { lat: 32.08, lng: 34.78 };
      expect(fn(far, site, 4000)).toBe(false);
    });
  });