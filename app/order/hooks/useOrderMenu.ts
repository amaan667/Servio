import { useState, useEffect, useRef, useCallback } from "react";
import { MenuItem } from "../types";
import { demoMenuItems } from "@/data/demoMenuItems";
import { safeGetItem, safeSetItem, safeParseJSON } from "../utils/safeStorage";
import { normalizeVenueId } from "@/lib/utils/venueId";

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  // Initialize with cached data for instant display
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    return safeParseJSON<MenuItem[]>(cached, []);
  });
  const [loadingMenu, setLoadingMenu] = useState(() => {
    // Only show loading if we have NO cached data at all
    if (typeof window === "undefined") return true;
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    const parsed = safeParseJSON<MenuItem[]>(cached, []);
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

  const loadingRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  const loadMenuItems = useCallback(async () => {
    if (!venueSlug) return;

    // Prevent duplicate fetches
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    // Only set loading true if we don't have cached data
    const cached = safeGetItem(sessionStorage, `menu_${venueSlug}`);
    const cachedItems = safeParseJSON<MenuItem[]>(cached, []);
    if (cachedItems.length === 0) {
      setLoadingMenu(true);
    }
    setMenuError(null);

    // Demo mode - load immediately without API
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
      loadingRef.current = false;
      return;
    }

    try {
      const apiUrl = `${window.location.origin}/api/menu/${venueSlug}`;
      
      // 15s timeout
      const controller = new AbortController();
      fetchTimeoutRef.current = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
      });

      clearTimeout(fetchTimeoutRef.current!);

      if (!response.ok) {
        throw new Error(response.statusText || "Failed to load menu");
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error("Invalid menu data");
      }

      const payload = data.data;
      const payloadVenueName = payload.venue?.name || "";

      const normalized = (payload.menuItems || []).map((mi: MenuItem) => ({
        ...mi,
        venue_name: payloadVenueName,
      }));

      // Update state with fresh data
      setMenuItems(normalized);
      setVenueName(payloadVenueName);
      setPdfImages(Array.isArray(payload.pdfImages) ? payload.pdfImages : []);
      setCategoryOrder(Array.isArray(payload.categoryOrder) ? payload.categoryOrder : null);

      // Cache the fresh data
      if (typeof window !== "undefined") {
        safeSetItem(sessionStorage, `menu_${venueSlug}`, JSON.stringify(normalized));
        safeSetItem(sessionStorage, `venue_name_${venueSlug}`, payloadVenueName);
        if (Array.isArray(payload.categoryOrder)) {
          safeSetItem(sessionStorage, `categories_${venueSlug}`, JSON.stringify(payload.categoryOrder));
        }
        if (Array.isArray(payload.pdfImages) && payload.pdfImages.length > 0) {
          safeSetItem(sessionStorage, `pdf_images_${venueSlug}`, JSON.stringify(payload.pdfImages));
        }
      }

      setLoadingMenu(false);
      loadingRef.current = false;
      retryCountRef.current = 0;

      // Fetch category order separately if needed
      if (!Array.isArray(payload.categoryOrder)) {
        try {
          const normalizedVenueId = normalizeVenueId(venueSlug) ?? venueSlug;
          const categoryResponse = await fetch(
            `${window.location.origin}/api/menu/categories?venueId=${normalizedVenueId}`
          );
          if (categoryResponse.ok) {
            const catData = await categoryResponse.json();
            if (Array.isArray(catData.categories)) {
              setCategoryOrder(catData.categories);
            }
          }
        } catch {
          // Non-fatal - categories are optional
        }
      }
    } catch (error) {
      clearTimeout(fetchTimeoutRef.current!);
      
      // Retry up to 3 times
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        loadingRef.current = false;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        return loadMenuItems();
      }

      // All retries exhausted - only show error if no cached data
      const errorMessage = error instanceof Error ? error.message : "Failed to load menu";
      if (cachedItems.length === 0) {
        setMenuError(errorMessage);
      }
      setLoadingMenu(false);
      loadingRef.current = false;
      retryCountRef.current = 0;
    }
  }, [venueSlug, isDemo]);

  // Load menu when venue changes
  useEffect(() => {
    if (venueSlug) {
      retryCountRef.current = 0;
      loadingRef.current = false;
      loadMenuItems();
    }
  }, [venueSlug, isDemo, loadMenuItems]);

  return {
    menuItems,
    loadingMenu,
    menuError,
    categoryOrder,
    venueName,
    pdfImages,
  };
}
