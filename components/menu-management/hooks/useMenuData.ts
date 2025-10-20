import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { MenuItem } from '../types';

export function useMenuData(venueId: string, refreshTrigger?: number) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);

  const venueUuid = venueId.startsWith('venue-') ? venueId : `venue-${venueId}`;
  const originalVenueId = venueId;
  const supabase = createClient();

  const fetchMenu = async () => {
    if (!supabase) {
      setError("Supabase client not available.");
      setLoading(false);
      return;
    }

    try {
      let { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueUuid)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (!data || data.length === 0) {
        const { data: fallbackData } = await supabase
          .from("menu_items")
          .select("*")
          .eq("venue_id", originalVenueId)
          .order("category", { ascending: true })
          .order("name", { ascending: true });
        
        if (fallbackData && fallbackData.length > 0) {
          data = fallbackData;
        }
      }

      let { data: uploadData } = await supabase
        .from("menu_uploads")
        .select("category_order")
        .eq("venue_id", venueUuid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!uploadData) {
        const { data: fallbackUploadData } = await supabase
          .from("menu_uploads")
          .select("category_order")
          .eq("venue_id", originalVenueId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fallbackUploadData) {
          uploadData = fallbackUploadData;
        }
      }

      if (error) {

        setError("Failed to load menu items.");
      } else {
        console.info("Menu fetched successfully", {
          itemCount: data?.length || 0,
          categories: [...new Set(data?.map((item: unknown) => item.category) || [])],
        });
        setMenuItems(data || []);
      }

      if (uploadData?.category_order && Array.isArray(uploadData.category_order)) {
        setCategoryOrder(uploadData.category_order);
      } else {
        setCategoryOrder(null);
      }
    } catch (error: unknown) {

      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    if (!supabase) return;

    const channel = supabase
      .channel(`menu-management-${venueUuid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `venue_id=eq.${venueUuid}`,
        },
        (payload: unknown) => {

          fetchMenu();
        },
      )
      .subscribe((status: unknown) => {

      });

    return () => {

      if (supabase) {
        createClient().removeChannel(channel);
      }
    };
  }, [venueUuid]);

  useEffect(() => {
    if (refreshTrigger) {
      fetchMenu();
    }
  }, [refreshTrigger]);

  return {
    menuItems,
    setMenuItems,
    loading,
    error,
    categoryOrder,
    fetchMenu,
  };
}

