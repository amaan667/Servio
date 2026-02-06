import { useState, useEffect, useRef, useCallback } from "react";
import { MenuItem } from "../types";
import { demoMenuItems } from "@/data/demoMenuItems";
import { normalizeVenueId } from "@/lib/utils/venueId";

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const [venueName, setVenueName] = useState<string>("");
  const [pdfImages, setPdfImages] = useState<string[]>([]);

  const loadingRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  const loadMenuItems = useCallback(async (retryCount = 0, maxRetries = 3) => {
    if (!venueSlug) return;

    // Prevent duplicate fetches
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMenu(true);
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
      
      // 15s timeout - fail fast, retry a few times
      const controller = new AbortController();
      fetchTimeoutRef.current = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        cache: "no-store", // Always fetch fresh - no caching
        credentials: "omit",
      });

      clearTimeout(fetchTimeoutRef.current!);

      if (!response.ok) {
        // Retry on error
        if (retryCount < maxRetries) {
          loadingRef.current = false;
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadMenuItems(retryCount + 1, maxRetries);
        }
        throw new Error(response.statusText || "Failed to load menu");
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        if (retryCount < maxRetries) {
          loadingRef.current = false;
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadMenuItems(retryCount + 1, maxRetries);
        }
        throw new Error("Invalid menu data");
      }

      const payload = data.data;
      const payloadVenueName = payload.venue?.name || "";

      const normalized = (payload.menuItems || []).map((mi: MenuItem) => ({
        ...mi,
        venue_name: payloadVenueName,
      }));

      setMenuItems(normalized);
      setVenueName(payloadVenueName);
      setPdfImages(Array.isArray(payload.pdfImages) ? payload.pdfImages : []);
      setCategoryOrder(Array.isArray(payload.categoryOrder) ? payload.categoryOrder : null);
      setLoadingMenu(false);
      loadingRef.current = false;

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
      
      // Retry on error
      if (retryCount < maxRetries) {
        loadingRef.current = false;
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadMenuItems(retryCount + 1, maxRetries);
      }

      // All retries exhausted - show error but stop loading
      const errorMessage = error instanceof Error ? error.message : "Failed to load menu";
      setMenuError(errorMessage);
      setLoadingMenu(false);
      loadingRef.current = false;
    }
  }, [venueSlug, isDemo]);

  // Load menu when venue changes
  useEffect(() => {
    if (venueSlug) {
      // Reset state for new venue
      setMenuItems([]);
      setCategoryOrder(null);
      setVenueName("");
      setPdfImages([]);
      setMenuError(null);
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
