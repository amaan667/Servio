import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { MenuItem } from "../types";

export function useMenuItems(venueId: string) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false); // Start with false to prevent showing 0 items
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const { toast } = useToast();

  const loadMenuItems = async () => {
    // Normalize venueId format - database stores with venue- prefix
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    try {
      setLoading(true);

      // Validate Supabase client creation
      let supabase;
      try {
        // Check environment variables before creating client
        const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!hasUrl || !hasAnonKey) {
          throw new Error(
            `Supabase environment variables missing. URL: ${hasUrl ? "✓" : "✗"}, AnonKey: ${hasAnonKey ? "✓" : "✗"}`
          );
        }

        supabase = createClient();

        // Verify client was created successfully
        if (!supabase) {
          throw new Error("Supabase client creation returned null/undefined");
        }
      } catch (clientError) {
        const errorMessage =
          clientError instanceof Error ? clientError.message : String(clientError);

        toast({
          title: "Configuration Error",
          description: `Database connection failed: ${errorMessage}. Please refresh the page or contact support.`,
          variant: "destructive",
        });
        return;
      }

      // Query ALL menu items (not filtered by is_available) to match dashboard count
      // ALWAYS use actual array length - it's the source of truth
      const { data: items, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .order("position", { ascending: true, nullsFirst: false });

      const actualItemCount = items?.length || 0;

      // Use console.warn for maximum visibility

      // Also log as plain console.log

      if (error) {
        logger.error("[MENU ITEMS] Error loading:", error);
        toast({
          title: "Error",
          description: `Failed to load menu items: ${error.message}`,
          variant: "destructive",
        });
        setMenuItems([]);
        return;
      }

      const itemCount = items?.length || 0;

      // CRITICAL LOG: Menu builder count when page loads
      // Log to both console (browser) and logger (Railway)
      const menuBuilderLogData = {
        venueId,
        normalizedVenueId,
        totalMenuItems: actualItemCount,
        itemsArrayLength: items?.length || 0,
        first3Items:
          items
            ?.slice(0, 3)
            .map((i) => ({ id: i.id, name: i.name, is_available: i.is_available })) || [],
        allItemIds: items?.map((i) => i.id) || [],
        timestamp: new Date().toISOString(),
      };

      // Log to Railway
      logger.info("[MENU BUILDER LOAD] Menu Items Count", menuBuilderLogData);

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
        description: `Failed to load menu items: ${_error instanceof Error ? _error.message : "Unknown error"}`,
        variant: "destructive",
      });
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load items immediately on mount
  useEffect(() => {
    if (venueId) {
      loadMenuItems();
    }
  }, [venueId]); // loadMenuItems is stable, don't need in deps

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
