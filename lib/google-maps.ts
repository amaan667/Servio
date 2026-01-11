
/**
 * Google Maps API Loader
 * Loads Google Maps JavaScript API with Places library
 */

// Extend window interface for Google Maps
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: unknown;
      };
    };
    initGoogleMaps?: () => void;
  }
}

let isLoading = false;
let isLoaded = false;

export function loadGoogleMapsAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (isLoaded || window.google?.maps?.places) {
      isLoaded = true;
      resolve();
      return;
    }

    // Check if already loading
    if (isLoading) {
      // Wait for the existing load to complete
      const checkInterval = setInterval(() => {
        if (isLoaded || window.google?.maps?.places) {
          isLoaded = true;
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Google Maps API loading timeout"));
      }, 10000);
      return;
    }

    // Get API key from environment (works in Next.js client components)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {

      reject(new Error("Google Maps API key not configured"));
      return;
    }

    isLoading = true;

    // Create script element
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;

    // Define global callback
    window.initGoogleMaps = () => {
      isLoaded = true;
      isLoading = false;
      resolve();
    };

    script.onerror = () => {
      isLoading = false;
      reject(new Error("Failed to load Google Maps API"));
    };

    document.head.appendChild(script);
  });
}

/**
 * Hook to load Google Maps on component mount
 */
export function useGoogleMaps() {
  if (typeof window === "undefined") return;

  loadGoogleMapsAPI().catch((_error) => {
    // Google Maps loading error handled silently
  });
}
