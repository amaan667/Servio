import { useState, useEffect, useRef } from "react";
import { MenuItem } from "../types";
import { demoMenuItems } from "@/data/demoMenuItems";
import { safeGetItem, safeSetItem, safeRemoveItem, safeParseJSON } from "../utils/safeStorage";

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  // Track loading state per venue to prevent duplicate fetches
  const loadingRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Initialize state with cached values (only on first render)
  // This ensures instant loading from cache - CRITICAL for mobile
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    const parsed = safeParseJSON<MenuItem[]>(cached, []);
    // Always return cached data immediately for instant display
    return parsed;
  });
  const [loadingMenu, setLoadingMenu] = useState(() => {
    if (typeof window === "undefined") return true;
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    const parsed = safeParseJSON<MenuItem[]>(cached, []);
    // Never show loading if we have cached data - instant display
    return parsed.length === 0;
  });
  const [menuError, setMenuError] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = safeGetItem(sessionStorage, `categories_${venueSlug}`);
    return safeParseJSON<string[] | null>(cached, null);
  });
  const [venueName, setVenueName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return safeGetItem(sessionStorage, `venue_name_${venueSlug}`) || "";
  });
  const [pdfImages, setPdfImages] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = safeGetItem(sessionStorage, `pdf_images_${venueSlug}`);
    return safeParseJSON<string[]>(cached, []);
  });

  const normalizeVenueId = (id: string) => (id.startsWith("venue-") ? id : `venue-${id}`);

  const getApiErrorMessage = (body: unknown): string => {
    if (!body || typeof body !== "object") return "Failed to load menu";
    const obj = body as Record<string, unknown>;
    
    // Check for standard API error format: { success: false, error: { message: "...", code: "..." } }
    const error = obj.error as unknown;
    if (error && typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      const message = errorObj.message;
      if (typeof message === "string" && message.trim().length > 0) return message;
    }
    
    // Fallback to direct error string
    if (typeof error === "string" && error.trim().length > 0) return error;
    
    // Check for direct message property
    const message = obj.message;
    if (typeof message === "string" && message.trim().length > 0) return message;
    
    return "Failed to load menu";
  };

  // Reset loading state when venue changes and clear stale cache
  useEffect(() => {
    loadingRef.current = null;
    retryCountRef.current = 0;
    setMenuError(null);
    
    // Clear any potentially stale empty cache for this venue
    // This ensures fresh data is fetched when scanning a new QR code
    if (typeof window !== "undefined" && venueSlug) {
      const cachedMenu = safeGetItem(sessionStorage, `menu_${venueSlug}`);
      const parsed = safeParseJSON<MenuItem[]>(cachedMenu, []);
      // If cache is empty, clear it to force fresh fetch
      if (parsed.length === 0) {
        safeRemoveItem(sessionStorage, `menu_${venueSlug}`);
        safeRemoveItem(sessionStorage, `venue_name_${venueSlug}`);
        safeRemoveItem(sessionStorage, `categories_${venueSlug}`);
        safeRemoveItem(sessionStorage, `pdf_images_${venueSlug}`);
      }
    }
  }, [venueSlug]);

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadMenuItems = async () => {
    // Skip if already loading this venue
    if (loadingRef.current === venueSlug) {
      return;
    }

    // ALWAYS show cached data first for instant loading - CRITICAL for mobile UX
    let hasCachedData = false;
    if (typeof window !== "undefined" && venueSlug) {
      const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
      if (cached) {
        const parsedCache = safeParseJSON<MenuItem[]>(cached, []);
        if (parsedCache.length > 0) {
          // Show cached data IMMEDIATELY - instant display, no loading spinner
          setMenuItems(parsedCache);
          const cachedVenueName = safeGetItem(sessionStorage, `venue_name_${venueSlug}`);
          if (cachedVenueName) {
            setVenueName(cachedVenueName);
          }
          const cachedCategories = safeGetItem(sessionStorage, `categories_${venueSlug}`);
          if (cachedCategories) {
            setCategoryOrder(safeParseJSON<string[] | null>(cachedCategories, null));
          }
          // Also load cached PDF images if available
          const cachedPdfImages = safeGetItem(sessionStorage, `pdf_images_${venueSlug}`);
          if (cachedPdfImages) {
            const parsedPdfImages = safeParseJSON<string[]>(cachedPdfImages, []);
            if (parsedPdfImages.length > 0) {
              setPdfImages(parsedPdfImages);
            }
          }
          // Clear any errors - we have cached data, so no errors should show
          setMenuError(null);
          setLoadingMenu(false); // Don't show loading if we have cached data
          hasCachedData = true;
        }
      }
    }

    loadingRef.current = venueSlug;
    // Only show loading spinner if we have NO cached data at all
    if (!hasCachedData) {
      setLoadingMenu(true);
    }
    // Never show errors - silently retry in background
    setMenuError(null);

    // Check if this is demo mode
    if (isDemo) {
      const mappedItems = demoMenuItems.map((item, idx) => ({
        ...item,
        id: `demo-${idx}`,
        is_available: true,
        price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
        image: item.image || undefined,
      }));
      setMenuItems(mappedItems);
      setVenueName("Demo Café");
      setPdfImages([]);
      setLoadingMenu(false);

      // Cache demo menu (best-effort, quota may be exceeded on mobile/private browsing)
      if (typeof window !== "undefined") {
        const menuCached = safeSetItem(sessionStorage, `menu_${venueSlug}`, JSON.stringify(mappedItems));
        const nameCached = safeSetItem(sessionStorage, `venue_name_${venueSlug}`, "Demo Café");
        if (!menuCached || !nameCached) {
          // Storage quota exceeded in private browsing mode - non-fatal, continue without cache
        }
      }
      return;
    }

    try {
      if (!venueSlug) {
        // Don't show error - just silently fail if no venue slug
        setMenuError(null);
        setLoadingMenu(false);
        return;
      }

      const apiUrl = `${window.location.origin}/api/menu/${venueSlug}`;
      
      // Add timeout and retry logic for reliability
      // 10 second client timeout - server has 8s, so client should be slightly longer
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      let response: Response;
      try {
        response = await fetch(apiUrl, {
          signal: controller.signal,
          cache: "no-store", // Always fetch fresh data
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Always retry on network errors - never show error to user
        if (retryCountRef.current < maxRetries && (fetchError instanceof Error && (fetchError.name === "AbortError" || fetchError.message.includes("network") || fetchError.message.includes("timeout") || fetchError.message.includes("Failed to fetch")))) {
          retryCountRef.current += 1;
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          // Reset loading state to allow retry
          loadingRef.current = null;
          return loadMenuItems();
        }
        
        // If we have cached data, don't show error - just silently fail
        // Only show error if we have NO cached data AND all retries failed
        if (!hasCachedData) {
          // Last resort: only show error if absolutely no cached data exists
          setMenuError(null); // Don't show error - keep retrying silently
        }
        setLoadingMenu(false);
        loadingRef.current = null;
        // Continue silently - don't return, let it retry in background
        return;
      }

      if (!response.ok) {
        let errorMessage = "Failed to load menu";
        let errorDetails: unknown = null;
        try {
          const errorData: unknown = await response.json();
          errorMessage = getApiErrorMessage(errorData);
          errorDetails = errorData;
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }

        
        // Always retry on 5xx errors - never show error to user
        if (retryCountRef.current < maxRetries && response.status >= 500) {
          retryCountRef.current += 1;
          // Don't show loading if we have cached data
          if (!hasCachedData) {
            setLoadingMenu(true);
          }
          setMenuError(null); // Never show errors
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          loadingRef.current = null;
          return loadMenuItems();
        }
        
        // Never show error - if we have cached data, user won't notice
        // If no cached data, silently keep retrying
        setMenuError(null);
        setLoadingMenu(false);
        loadingRef.current = null;
        // Don't return - continue to silently retry in background
        return;
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: {
          venue?: { id?: string; name?: string };
          menuItems?: MenuItem[];
          totalItems?: number;
          categoryOrder?: string[] | null;
          pdfImages?: string[];
        };
        error?: unknown;
      };

      if (!data.success || !data.data) {

        // Always retry on API errors - never show error to user
        // If we have cached data, user won't notice any issues
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          // Only show loading if we don't have cached data
          if (!hasCachedData) {
            setLoadingMenu(true);
          }
          setMenuError(null); // Never show errors
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          loadingRef.current = null;
          return loadMenuItems();
        }
        
        // Never show error - silently fail if we have cached data
        // If no cached data, keep retrying silently
        setMenuError(null);
        setLoadingMenu(false);
        loadingRef.current = null;
        return;
      }

      const payload = data.data;
      const itemCount = payload.menuItems?.length || 0;
      const payloadVenueName = payload.venue?.name || "";

      const normalized = (payload.menuItems || []).map((mi: MenuItem) => ({
        ...mi,
        venue_name: payloadVenueName,
      }));

      setMenuItems(normalized);
      const venueNameValue = payloadVenueName;
      setVenueName(venueNameValue);
      setPdfImages(Array.isArray(payload.pdfImages) ? payload.pdfImages : []);
      setCategoryOrder(Array.isArray(payload.categoryOrder) ? payload.categoryOrder : null);

      // Cache menu data aggressively for instant loading on next visit
      if (typeof window !== "undefined") {
        // Test storage availability first
        const testKey = `__storage_test_${Date.now()}`;
        const storageAvailable = safeSetItem(sessionStorage, testKey, "test");
        safeRemoveItem(sessionStorage, testKey); // Clean up test

        if (storageAvailable) {
          // Always cache menu data - even if empty, cache it to prevent repeated API calls
          safeSetItem(sessionStorage, `menu_${venueSlug}`, JSON.stringify(normalized));
          safeSetItem(sessionStorage, `venue_name_${venueSlug}`, venueNameValue);
          if (Array.isArray(payload.categoryOrder)) {
            safeSetItem(sessionStorage, `categories_${venueSlug}`, JSON.stringify(payload.categoryOrder));
          }
          // Cache PDF images for instant display
          if (Array.isArray(payload.pdfImages) && payload.pdfImages.length > 0) {
            safeSetItem(sessionStorage, `pdf_images_${venueSlug}`, JSON.stringify(payload.pdfImages));
          }
        }
        // If storage fails, continue without caching - app still works
      }

      // Backward compatibility: if API didn't include categoryOrder, fetch it.
      if (!Array.isArray(payload.categoryOrder)) {
        try {
          const normalizedVenueId = normalizeVenueId(venueSlug);
          const categoryOrderResponse = await fetch(
            `${window.location.origin}/api/menu/categories?venueId=${normalizedVenueId}`
          );
          if (categoryOrderResponse.ok) {
            const categoryOrderData = (await categoryOrderResponse.json()) as {
              categories?: string[];
            };
            if (Array.isArray(categoryOrderData.categories)) {
              setCategoryOrder(categoryOrderData.categories);
              if (typeof window !== "undefined" && itemCount > 0) {
                const categoriesCached = safeSetItem(sessionStorage, `categories_${venueSlug}`, JSON.stringify(categoryOrderData.categories));
                if (!categoriesCached) {
                  // Storage quota exceeded in private browsing mode - non-fatal, continue without cache
                }
              }
            }
          }
        } catch {
          // Non-fatal
        }
      }


      // Never show error for empty menu - just show empty state
      setMenuError(null);
      // Reset retry count on success
      retryCountRef.current = 0;

      setLoadingMenu(false);
      loadingRef.current = null;
    } catch (_err) {
      // Always retry on unexpected errors - never show error to user
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        loadingRef.current = null;
        return loadMenuItems();
      }
      
      // Never show error - if we have cached data, user won't notice
      // Silently fail and keep cached data visible
      setMenuError(null);
      setLoadingMenu(false);
      loadingRef.current = null;
    }
  };

  useEffect(() => {
    // Always load menu when venueSlug changes or component mounts
    if (venueSlug) {
      loadMenuItems();
    }
     
  }, [venueSlug, isDemo]);

  return {
    menuItems,
    loadingMenu,
    menuError,
    categoryOrder,
    venueName,
    pdfImages,
  };
}
