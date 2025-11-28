import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { MenuItem } from "../types";

export function useMenuItems(venueId: string) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const { toast } = useToast();

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Normalize venueId format - database stores with venue- prefix
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      const { data: items, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .order("position", { ascending: true, nullsFirst: false });

      if (error) {
        logger.error("[MENU ITEMS] Error loading:", error);
        toast({
          title: "Error",
          description: `Failed to load menu items: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      setMenuItems(items || []);

      if (items && items.length > 0) {
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
        const { data: uploadData } = await supabase
          .from("menu_uploads")
          .select("category_order")
          .eq("venue_id", normalizedVenueId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (uploadData && uploadData.length > 0) {
          setCategoryOrder(uploadData[0]?.category_order);
        }
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: `Failed to load menu items: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      loadMenuItems();
    }
  }, [venueId]);

  // Auto-refresh when window regains focus to prevent stale data
  useEffect(() => {
    const handleFocus = () => {
      loadMenuItems();
    };

    // Also refresh on visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadMenuItems();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [venueId]);

  return {
    menuItems,
    loading,
    categoryOrder,
    setCategoryOrder,
    setMenuItems,
    loadMenuItems,
  };
}
