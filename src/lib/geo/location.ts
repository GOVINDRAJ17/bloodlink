/**
 * High-Accuracy Live Location & Reverse Geocoding Utility
 * With in-flight deduplication, localStorage/memory caching, and timeout resilience.
 */

export interface PreciseLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
  address?: string;
  cityName?: string;
}

// In-memory cache for fast hot lookups during the active session
const inMemoryGeocodeCache = new Map<string, { address: string; cityName: string; timestamp: number }>();
// In-flight promise map to deduplicate concurrent requests (e.g. React Strict Mode double mount)
const inFlightGeocodes = new Map<string, Promise<{ address: string; cityName: string }>>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function reverseGeocodeWithCache(lat: number, lng: number): Promise<{ address: string; cityName: string }> {
  // Round to 3 decimal places (~110 meters) for spatial locality cache hits
  const rLat = Math.round(lat * 1000) / 1000;
  const rLng = Math.round(lng * 1000) / 1000;
  const cacheKey = `bl_geocode_${rLat}_${rLng}`;

  // 1. Check in-memory session cache
  const memHit = inMemoryGeocodeCache.get(cacheKey);
  if (memHit && Date.now() - memHit.timestamp < CACHE_TTL_MS) {
    return { address: memHit.address, cityName: memHit.cityName };
  }

  // 2. Check browser localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          inMemoryGeocodeCache.set(cacheKey, parsed);
          return { address: parsed.address, cityName: parsed.cityName };
        }
      }
    } catch {
      // localStorage may fail in private mode; silently proceed
    }
  }

  // 3. Deduplicate in-flight requests for identical coordinates
  if (inFlightGeocodes.has(cacheKey)) {
    return inFlightGeocodes.get(cacheKey)!;
  }

  // 4. Fetch from Nominatim with strict 4s timeout & compliant User-Agent
  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let address = "Current GPS Location";
    let cityName = "Local Area";

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            "User-Agent": "BloodLink-Emergency-App/1.0 (contact@bloodlink.org; emergency response geocoder)",
            Accept: "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        address = data.display_name || "Current GPS Location";
        cityName =
          data.address?.city ||
          data.address?.town ||
          data.address?.suburb ||
          data.address?.county ||
          "Local Area";

        const cacheEntry = { address, cityName, timestamp: Date.now() };
        inMemoryGeocodeCache.set(cacheKey, cacheEntry);

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
          } catch {
            // Ignore quota issues
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name !== "AbortError") {
        console.warn("Reverse geocoding error:", err.message);
      }
    } finally {
      inFlightGeocodes.delete(cacheKey);
    }

    return { address, cityName };
  })();

  inFlightGeocodes.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function getPreciseLiveLocation(): Promise<PreciseLocation> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by your browser or environment."));
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracyMeters = position.coords.accuracy || 10;

        const { address, cityName } = await reverseGeocodeWithCache(lat, lng);

        resolve({
          lat,
          lng,
          accuracyMeters,
          address,
          cityName,
        });
      },
      (error) => {
        let msg = "Could not fetch location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission denied. Please allow location access in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Location position unavailable. Ensure your GPS/Wi-Fi is enabled.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Location request timed out. Retrying with standard accuracy...";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000, // Reuse fresh browser position up to 30s
      }
    );
  });
}
