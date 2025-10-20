import { useState, useEffect, useCallback } from 'react';
import { MenuItem } from '../types';
import { demoMenuItems } from '@/data/demoMenuItems';

export function useOrderMenu(venueSlug: string, isDemo: boolean) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const [venueName, setVenueName] = useState<string>('Our Venue');

  const loadMenuItems = useCallback(async () => {
    setLoadingMenu(true);
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
        const errorData = await response.json();
        setMenuError(`Error loading menu: ${errorData.error || 'Failed to load menu'}`);
        setLoadingMenu(false);
        return;
      }

      const data = await response.json();
      
      const normalized = (data.menuItems || []).map((mi: unknown) => ({ 
        ...mi, 
        venue_name: data.venue?.venue_name || 'Our Venue'
      }));
      
      setMenuItems(normalized);
      
      // Fetch category order
      try {
        const categoryOrderResponse = await fetch(`${window.location.origin}/api/menu/categories?venueId=${venueSlug}`);
        if (categoryOrderResponse.ok) {
          const categoryOrderData = await categoryOrderResponse.json();
          if (categoryOrderData.categories && Array.isArray(categoryOrderData.categories)) {
            setCategoryOrder(categoryOrderData.categories);
          }
        }
      } catch (error) {
        setCategoryOrder(null);
      }
      
      if (!data.menuItems || data.menuItems.length === 0) {
        setMenuError("This venue has no available menu items yet.");
      }
      
      setLoadingMenu(false);
    } catch (err: unknown) {
      setMenuError(`Error loading menu: ${err.message}`);
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

