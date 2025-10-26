import { useState, useEffect, useCallback } from 'react';
import { MenuItem } from '../types';
import { demoMenuItems } from '@/data/demoMenuItems';

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  // Cache helper functions
  const getCachedMenu = () => {
    if (typeof window === 'undefined') return null;
    const cached = sessionStorage.getItem(`menu_${venueSlug}`);
    return cached ? JSON.parse(cached) : null;
  };

  const getCachedVenueName = () => {
    if (typeof window === 'undefined') return 'Our Venue';
    return sessionStorage.getItem(`venue_name_${venueSlug}`) || 'Our Venue';
  };

  const getCachedCategories = () => {
    if (typeof window === 'undefined') return null;
    const cached = sessionStorage.getItem(`categories_${venueSlug}`);
    return cached ? JSON.parse(cached) : null;
  };

  const [menuItems, setMenuItems] = useState<MenuItem[]>(getCachedMenu() || []);
  const [loadingMenu, setLoadingMenu] = useState(!getCachedMenu()); // No loading if we have cache
  const [menuError, setMenuError] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(getCachedCategories());
  const [venueName, setVenueName] = useState<string>(getCachedVenueName());

  const loadMenuItems = useCallback(async () => {
    // Don't show loading if we have cached data
    if (!menuItems || menuItems.length === 0) {
      setLoadingMenu(true);
    }
    setMenuError(null);

    // Check if this is demo mode
    if (isDemo || venueSlug === 'demo-cafe') {
      const mappedItems = demoMenuItems.map((item, idx) => ({
        ...item,
        id: `demo-${idx}`,
        is_available: true,
        price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
        image: item.image || undefined,
      }));
      setMenuItems(mappedItems);
      setVenueName('Demo Café');
      setLoadingMenu(false);
      
      // Cache demo menu
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`menu_${venueSlug}`, JSON.stringify(mappedItems));
        sessionStorage.setItem(`venue_name_${venueSlug}`, 'Demo Café');
      }
      return;
    }

    try {
      if (!venueSlug) {
        setMenuError("Invalid or missing venue in QR link.");
        setLoadingMenu(false);
        return;
      }

      setVenueName('Cafe Nur');

      const apiUrl = `${window.location.origin}/api/menu/${venueSlug}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        let errorMessage = 'Failed to load menu';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        setMenuError(`Error loading menu: ${errorMessage}`);
        setLoadingMenu(false);
        return;
      }

      const data = await response.json();
      
      const normalized = (data.menuItems || []).map((mi: Record<string, unknown>) => ({ 
        ...mi, 
        venue_name: data.venue?.venue_name || 'Our Venue'
      }));
      
      setMenuItems(normalized);
      const venueNameValue = data.venue?.venue_name || 'Our Venue';
      setVenueName(venueNameValue);
      
      // Cache menu data
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`menu_${venueSlug}`, JSON.stringify(normalized));
        sessionStorage.setItem(`venue_name_${venueSlug}`, venueNameValue);
      }
      
      // Fetch category order
      try {
        const categoryOrderResponse = await fetch(`${window.location.origin}/api/menu/categories?venueId=${venueSlug}`);
        if (categoryOrderResponse.ok) {
          const categoryOrderData = await categoryOrderResponse.json();
          if (categoryOrderData.categories && Array.isArray(categoryOrderData.categories)) {
            setCategoryOrder(categoryOrderData.categories);
            // Cache categories
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`categories_${venueSlug}`, JSON.stringify(categoryOrderData.categories));
            }
          }
        }
      } catch (_error) {
        setCategoryOrder(null);
      }
      
      if (!data.menuItems || data.menuItems.length === 0) {
        setMenuError("This venue has no available menu items yet.");
      }
      
      setLoadingMenu(false);
    } catch (_err) {
      setMenuError(`Error loading menu: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
  };
}

