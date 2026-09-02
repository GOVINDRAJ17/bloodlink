/**
 * High-Accuracy Live Location & Reverse Geocoding Utility
 */

export interface PreciseLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
  address?: string;
  cityName?: string;
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

        let address = "";
        let cityName = "";

        // Reverse Geocoding via OpenStreetMap Nominatim API
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { "User-Agent": "BloodLink-Emergency-App/1.0" } }
          );
          if (response.ok) {
            const data = await response.json();
            address = data.display_name || "";
            cityName = data.address?.city || data.address?.town || data.address?.county || "Local Area";
          }
        } catch (err) {
          console.warn("Reverse geocoding error:", err);
        }

        resolve({
          lat,
          lng,
          accuracyMeters,
          address,
          cityName
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
        maximumAge: 0
      }
    );
  });
}
