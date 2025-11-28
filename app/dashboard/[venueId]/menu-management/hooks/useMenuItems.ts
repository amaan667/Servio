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
        
        console.log("[MENU BUILDER] Environment check:", {
          hasUrl,
          hasAnonKey,
          urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) || "none",
          anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) || "none",
        });

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
        const errorMessage = clientError instanceof Error ? clientError.message : String(clientError);
        console.error("[MENU BUILDER] Failed to create Supabase client:", {
          error: errorMessage,
          venueId,
          normalizedVenueId,
          timestamp: new Date().toISOString(),
          stack: clientError instanceof Error ? clientError.stack : undefined,
        });
        toast({
          title: "Configuration Error",
          description: `Database connection failed: ${errorMessage}. Please refresh the page or contact support.`,
          variant: "destructive",
        });
        return;
      }

      console.log("[MENU BUILDER] Loading menu items:", {
        originalVenueId: venueId,
        normalizedVenueId,
        hasSupabaseClient: !!supabase,
        timestamp: new Date().toISOString(),
      });

      const { data: items, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .order("position", { ascending: true, nullsFirst: false });

      console.log("[MENU BUILDER] Query result:", {
        itemCount: items?.length || 0,
        error: error?.message || null,
        errorCode: error?.code || null,
        errorDetails: error?.details || null,
        sampleItem: items?.[0] || null,
      });

      if (error) {
        console.error("[MENU BUILDER] Error loading menu items:", {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          normalizedVenueId,
          fullError: error,
          timestamp: new Date().toISOString(),
        });
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
        totalMenuItems: itemCount,
        itemsArrayLength: items?.length || 0,
        first3Items: items?.slice(0, 3).map((i) => ({ id: i.id, name: i.name, is_available: i.is_available })) || [],
        allItemIds: items?.map((i) => i.id) || [],
        timestamp: new Date().toISOString(),
      };
      
      console.log("═══════════════════════════════════════════════════════════");
      console.log("🔧 [MENU BUILDER LOAD] Menu Items Count");
      console.log("═══════════════════════════════════════════════════════════");
      console.log("Venue ID:", venueId);
      console.log("Normalized Venue ID:", normalizedVenueId);
      console.log("Total Menu Items:", itemCount);
      console.log("Items Array Length:", items?.length || 0);
      console.log("First 3 Items:", menuBuilderLogData.first3Items);
      console.log("⚠️  THIS IS THE COUNT THAT SHOULD MATCH DASHBOARD");
      console.log("⚠️  Dashboard should show:", itemCount);
      console.log("Timestamp:", new Date().toISOString());
      console.log("═══════════════════════════════════════════════════════════");
      
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
      console.error("[MENU BUILDER] Exception loading menu items:", {
        error: _error instanceof Error ? _error.message : String(_error),
        stack: _error instanceof Error ? _error.stack : undefined,
        venueId,
        normalizedVenueId,
        timestamp: new Date().toISOString(),
      });
      toast({
        title: "Error",
        description: `Failed to load menu items: ${_error instanceof Error ? _error.message : "Unknown error"}`,
        variant: "destructive",
      });
      setMenuItems([]);
    } finally {
      setLoading(false);
      console.log("[MENU BUILDER] loadMenuItems completed:", {
        venueId,
        loading: false,
        itemCount: menuItems.length,
        timestamp: new Date().toISOString(),
      });
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
