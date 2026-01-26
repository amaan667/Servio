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
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    return safeParseJSON<MenuItem[]>(cached, []);
  });
  const [loadingMenu, setLoadingMenu] = useState(() => {
    if (typeof window === "undefined") return true;
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    return !cached;
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
  const [pdfImages, setPdfImages] = useState<string[]>([]);

  const normalizeVenueId = (id: string) => (id.startsWith("venue-") ? id : `venue-${id}`);

  const getApiErrorMessage = (body: unknown): string => {
    if (!body || typeof body !== "object") return "Failed to load menu";
    const obj = body as Record<string, unknown>;
    const error = obj.error as unknown;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      const message = errorObj.message;
      if (typeof message === "string" && message.trim().length > 0) return message;
    }
    const message = obj.message;
    if (typeof message === "string" && message.trim().length > 0) return message;
    return "Failed to load menu";
  };

  // Reset loading state when venue changes
  useEffect(() => {
    loadingRef.current = null;
    retryCountRef.current = 0;
    setMenuError(null);
  }, [venueSlug]);

  // Derived function - no useCallback needed (React Compiler handles this)
  const loadMenuItems = async () => {
    // Skip if already loading this venue
    if (loadingRef.current === venueSlug) {
      return;
    }

    // Check if we have cached data first - show it immediately
    let hasCachedData = false;
    if (typeof window !== "undefined" && venueSlug) {
      const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
      if (cached) {
        const parsedCache = safeParseJSON<MenuItem[]>(cached, []);
        if (parsedCache.length > 0) {
          // Show cached data immediately while fetching fresh data in background
          setMenuItems(parsedCache);
          const cachedVenueName = safeGetItem(sessionStorage, `venue_name_${venueSlug}`);
          if (cachedVenueName) {
            setVenueName(cachedVenueName);
          }
          const cachedCategories = safeGetItem(sessionStorage, `categories_${venueSlug}`);
          if (cachedCategories) {
            setCategoryOrder(safeParseJSON<string[] | null>(cachedCategories, null));
          }
          setMenuError(null);
          hasCachedData = true;
          // Continue to fetch fresh data in background - don't return early
        }
      }
    }

    loadingRef.current = venueSlug;
    // Only show loading if we don't have cached data
    if (!hasCachedData) {
      setLoadingMenu(true);
    }
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
        setMenuError("Invalid or missing venue in QR link.");
        setLoadingMenu(false);
        return;
      }

      const apiUrl = `${window.location.origin}/api/menu/${venueSlug}`;
      
      // Add timeout and retry logic for reliability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
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
        
        // Retry on network errors or timeouts
        if (retryCountRef.current < maxRetries && (fetchError instanceof Error && (fetchError.name === "AbortError" || fetchError.message.includes("network") || fetchError.message.includes("timeout") || fetchError.message.includes("Failed to fetch")))) {
          retryCountRef.current += 1;
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          // Reset loading state to allow retry
          loadingRef.current = null;
          return loadMenuItems();
        }
        
        setMenuError(`Error loading menu: ${fetchError instanceof Error ? fetchError.message : "Network error. Please check your connection and try again."}`);
        setLoadingMenu(false);
        loadingRef.current = null;
        return;
      }

      if (!response.ok) {
        let errorMessage = "Failed to load menu";
        try {
          const errorData: unknown = await response.json();
          errorMessage = getApiErrorMessage(errorData);
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        // Retry on 5xx errors
        if (retryCountRef.current < maxRetries && response.status >= 500) {
          retryCountRef.current += 1;
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          loadingRef.current = null;
          return loadMenuItems();
        }
        
        setMenuError(`Error loading menu: ${errorMessage}`);
        setLoadingMenu(false);
        loadingRef.current = null;
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
        const errorMessage = getApiErrorMessage(data);
        
        // Retry on API errors
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          loadingRef.current = null;
          return loadMenuItems();
        }
        
        setMenuError(`Error loading menu: ${errorMessage}`);
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

      // Cache menu data only if storage is working (skip in private browsing)
      if (typeof window !== "undefined") {
        // Test storage availability first
        const testKey = `__storage_test_${Date.now()}`;
        const storageAvailable = safeSetItem(sessionStorage, testKey, "test");
        safeRemoveItem(sessionStorage, testKey); // Clean up test

        if (storageAvailable) {
          // Only cache if storage works
          if (itemCount > 0) {
            safeSetItem(sessionStorage, `menu_${venueSlug}`, JSON.stringify(normalized));
            safeSetItem(sessionStorage, `venue_name_${venueSlug}`, venueNameValue);
            if (Array.isArray(payload.categoryOrder)) {
              safeSetItem(sessionStorage, `categories_${venueSlug}`, JSON.stringify(payload.categoryOrder));
            }
          } else {
            // Clear cache when no items
            safeRemoveItem(sessionStorage, `menu_${venueSlug}`);
            safeRemoveItem(sessionStorage, `venue_name_${venueSlug}`);
            safeRemoveItem(sessionStorage, `categories_${venueSlug}`);
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

      if (itemCount === 0) {
        setMenuError("This venue has no available menu items yet.");
      } else {
        setMenuError(null);
        // Reset retry count on success
        retryCountRef.current = 0;
      }

      setLoadingMenu(false);
      loadingRef.current = null;
      
      // Clear any previous errors on successful load
      if (itemCount > 0) {
        setMenuError(null);
      }
    } catch (_err) {
      // Retry on unexpected errors
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        loadingRef.current = null;
        return loadMenuItems();
      }
      
      setMenuError(`Error loading menu: ${_err instanceof Error ? _err.message : "Unknown error. Please try refreshing the page."}`);
      setLoadingMenu(false);
      loadingRef.current = null;
    }
  };

  useEffect(() => {
    // Always load menu when venueSlug changes or component mounts
    if (venueSlug) {
      loadMenuItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
