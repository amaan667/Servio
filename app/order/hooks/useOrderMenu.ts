import { useState, useEffect, useCallback, useRef } from "react";
import { MenuItem } from "../types";
import { demoMenuItems } from "@/data/demoMenuItems";
import { safeGetItem, safeSetItem, safeRemoveItem, safeParseJSON } from "../utils/safeStorage";

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  // Track if we've already loaded to prevent duplicate fetches
  const hasLoadedRef = useRef(false);

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

  const loadMenuItems = useCallback(async () => {
    // Skip if already loaded or loading
    if (hasLoadedRef.current) {
      return;
    }

    // Check if we have cached data
    if (typeof window !== "undefined") {
      const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
      if (cached) {
        const parsedCache = safeParseJSON<MenuItem[]>(cached, []);
        if (parsedCache.length > 0) {
          hasLoadedRef.current = true;
          return;
        }
      }
    }

    hasLoadedRef.current = true;
    setLoadingMenu(true);
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

      // Cache demo menu (best-effort, quota may be exceeded on mobile)
      if (typeof window !== "undefined") {
        safeSetItem(sessionStorage, `menu_${venueSlug}`, JSON.stringify(mappedItems));
        safeSetItem(sessionStorage, `venue_name_${venueSlug}`, "Demo Café");
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
      const response = await fetch(apiUrl);

      if (!response.ok) {
        let errorMessage = "Failed to load menu";
        try {
          const errorData: unknown = await response.json();
          errorMessage = getApiErrorMessage(errorData);
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        setMenuError(`Error loading menu: ${errorMessage}`);
        setLoadingMenu(false);
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
        setMenuError(`Error loading menu: ${errorMessage}`);
        setLoadingMenu(false);
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

      // Clear cache if no items to prevent stale data (best-effort, quota may be exceeded)
      if (typeof window !== "undefined") {
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
                safeSetItem(sessionStorage, `categories_${venueSlug}`, JSON.stringify(categoryOrderData.categories));
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
      }

      setLoadingMenu(false);
    } catch (_err) {
      setMenuError(`Error loading menu: ${_err instanceof Error ? _err.message : "Unknown error"}`);
      setLoadingMenu(false);
    }
  }, [venueSlug, isDemo]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  return {
    menuItems,
    loadingMenu,
    menuError,
    categoryOrder,
    venueName,
    pdfImages,
  };
}
