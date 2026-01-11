import { useState, useEffect, useCallback } from "react";
import { MenuItem } from "../types";
import { demoMenuItems } from "@/data/demoMenuItems";

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  // Cache helper functions
  const getCachedMenu = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`menu_${venueSlug}`);
    return cached ? JSON.parse(cached) : null;
  };

  const getCachedVenueName = () => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(`venue_name_${venueSlug}`) || "";
  };

  const getCachedCategories = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`categories_${venueSlug}`);
    return cached ? JSON.parse(cached) : null;
  };

  const cachedMenu = getCachedMenu();
  const cachedCategories = getCachedCategories();
  const cachedVenueName = getCachedVenueName();

  const [menuItems, setMenuItems] = useState<MenuItem[]>(cachedMenu || []);
  const [loadingMenu, setLoadingMenu] = useState(!cachedMenu); // No loading if we have cache
  const [menuError, setMenuError] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(cachedCategories);
  const [venueName, setVenueName] = useState<string>(cachedVenueName);
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
    // Skip fetch if we have cached data - instant load
    if (cachedMenu && cachedMenu.length > 0) {
      return;
    }

    // Don't show loading if we have cached data
    if (!menuItems || menuItems.length === 0) {
      setLoadingMenu(true);
    }
    setMenuError(null);

    // Check if this is demo mode
    if (isDemo) {
      const mappedItems = demoMenuItems.map((item, idx) => ({
        ...item,
        id: `demo-${idx}`,

      }));
      setMenuItems(mappedItems);
      setVenueName("Demo Café");
      setPdfImages([]);
      setLoadingMenu(false);

      // Cache demo menu
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`menu_${venueSlug}`, JSON.stringify(mappedItems));
        sessionStorage.setItem(`venue_name_${venueSlug}`, "Demo Café");
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

      }));

      setMenuItems(normalized);
      const venueNameValue = payloadVenueName;
      setVenueName(venueNameValue);
      setPdfImages(Array.isArray(payload.pdfImages) ? payload.pdfImages : []);
      setCategoryOrder(Array.isArray(payload.categoryOrder) ? payload.categoryOrder : null);

      // Clear cache if no items to prevent stale data
      if (typeof window !== "undefined") {
        if (itemCount > 0) {
          sessionStorage.setItem(`menu_${venueSlug}`, JSON.stringify(normalized));
          sessionStorage.setItem(`venue_name_${venueSlug}`, venueNameValue);
          if (Array.isArray(payload.categoryOrder)) {
            sessionStorage.setItem(
              `categories_${venueSlug}`,
              JSON.stringify(payload.categoryOrder)
            );
          }
        } else {
          // Clear cache when no items
          sessionStorage.removeItem(`menu_${venueSlug}`);
          sessionStorage.removeItem(`venue_name_${venueSlug}`);
          sessionStorage.removeItem(`categories_${venueSlug}`);
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
                sessionStorage.setItem(
                  `categories_${venueSlug}`,
                  JSON.stringify(categoryOrderData.categories)
                );
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
  }, [venueSlug, isDemo, cachedMenu]);

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
