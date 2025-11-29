import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withSupabaseRetry } from "@/lib/retry";
import { todayWindowForTZ } from "@/lib/time";
import {
  getCachedCounts,
  setCachedCounts,
  isCacheFresh,
  type CachedCounts,
} from "@/lib/cache/count-cache";

export interface DashboardCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  tables_in_use: number;
  tables_reserved_now: number;
}

export interface DashboardStats {
  revenue: number;
  menuItems: number;
  unpaid: number;
}

export function useDashboardData(
  venueId: string,
  venueTz: string,
  initialVenue: unknown,
  initialCounts?: DashboardCounts,
  initialStats?: DashboardStats
) {
  // Use shared cache utility for counts

  const getCachedStats = () => {
    if (typeof window === "undefined") return null;
    // IMPORTANT: Cache key MUST include venueId to prevent cross-venue data leaks
    const cached = sessionStorage.getItem(`dashboard_stats_${venueId}`);
    if (!cached) return null;

    try {
      const parsed = JSON.parse(cached);
      // Verify cache is for correct venue (extra safety)
      return parsed;
    } catch {
      return null;
    }
  };

  const [venue, setVenue] = useState<unknown>(initialVenue);
  const [loading, setLoading] = useState(false); // Start with false - we have initial data

  // Priority: initialCounts from server → cached → default 0
  // NEVER show 0 if we have cached data - this prevents flicker
  const [counts, setCounts] = useState<DashboardCounts>(() => {
    const cached = getCachedCounts(venueId);
    if (cached) {
      return {
        live_count: cached.live_count || 0,
        earlier_today_count: cached.earlier_today_count || 0,
        history_count: cached.history_count || 0,
        today_orders_count: cached.today_orders_count || 0,
        active_tables_count: cached.active_tables_count || 0,
        tables_set_up: cached.tables_set_up || 0,
        tables_in_use: cached.tables_in_use || 0,
        tables_reserved_now: cached.tables_reserved_now || 0,
      };
    }
    if (initialCounts) return initialCounts;
    return {
      live_count: 0,
      earlier_today_count: 0,
      history_count: 0,
      today_orders_count: 0,
      active_tables_count: 0,
      tables_set_up: 0,
      tables_in_use: 0,
      tables_reserved_now: 0,
    };
  });

  // Priority: ALWAYS use initialStats from server - NEVER use cache for stats
  // Cache causes stale counts - force fresh data every time
  const [stats, setStats] = useState<DashboardStats>(() => {
    // ALWAYS prefer server data - it's guaranteed fresh
    if (initialStats) {
      // Log to console.error for Railway visibility
      const logData = {
        menuItems: initialStats.menuItems,
        revenue: initialStats.revenue,
        unpaid: initialStats.unpaid,
        timestamp: new Date().toISOString(),
      };
      // Use console.warn for maximum visibility
      console.warn("═══════════════════════════════════════════════════════════");
      console.warn("[DASHBOARD DATA] ✅ INITIALIZING with initialStats from server");
      console.warn("═══════════════════════════════════════════════════════════");
      console.warn("Menu Items Count:", initialStats.menuItems);
      console.warn("Revenue:", initialStats.revenue);
      console.warn("Unpaid:", initialStats.unpaid);
      console.warn("⚠️  This menuItems count will be displayed:", initialStats.menuItems);
      console.warn("⚠️  loadStats will NOT override this count");
      console.warn("═══════════════════════════════════════════════════════════");
      
      // Also log as plain console.log
      console.log("DASHBOARD initialStats COUNT:", initialStats.menuItems, "items");
      return initialStats;
    }
    // If no server data, use defaults - NEVER use cache for stats
    console.log("[DASHBOARD DATA] ⚠️ No server data, using defaults (menuItems: 0)");
    return { revenue: 0, menuItems: 0, unpaid: 0 };
  });
  
  // CRITICAL: Force update stats when initialStats changes
  // This MUST run immediately to prevent loadStats from overriding with stale data
  useEffect(() => {
    if (initialStats) {
      const oldCount = stats.menuItems;
      const newCount = initialStats.menuItems;
      
      // Use console.warn for maximum visibility
      console.warn("[DASHBOARD DATA] initialStats received from server:", {
        old: oldCount,
        new: newCount,
        changed: oldCount !== newCount,
      });
      
      // ALWAYS update immediately - this is the source of truth from server
      // Don't let loadStats override this on initial mount
      setStats(initialStats);
      
      if (oldCount !== newCount) {
        console.warn("✅ [DASHBOARD DATA] Count updated from server:", oldCount, "→", newCount);
        console.log("DASHBOARD COUNT UPDATE:", oldCount, "→", newCount);
      }
    }
  }, [initialStats?.menuItems, initialStats?.revenue, initialStats?.unpaid]); // Depend on values, not object reference
  
  // CRITICAL: Mark that we've received initialStats to prevent loadStats from overriding
  // Initialize immediately if initialStats exists - this must be set BEFORE loadStats can be called
  const hasInitialStats = !!initialStats; // Use direct check, not state - ensures it's always current
  
  // Log immediately when initialStats exists
  if (initialStats) {
    console.warn("[DASHBOARD DATA] ✅ initialStats available:", initialStats.menuItems, "items");
    console.warn("[DASHBOARD DATA] ✅ hasInitialStats=true, loadStats will NOT override menuItems");
  }
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // DON'T cache initialStats - always use fresh server data
  // Only cache counts, not stats (stats should always be fresh from server)
  useEffect(() => {
    if (initialCounts) {
      setCachedCounts(venueId, initialCounts);
    }
    // DO NOT cache initialStats - it causes stale counts
    // Always use fresh server data for menu items count
    if (initialStats && typeof window !== "undefined") {
      // Clear any old cached stats to force fresh data
      sessionStorage.removeItem(`dashboard_stats_${venueId}`);
      console.log("[DASHBOARD DATA] Cleared cached stats to force fresh data:", {
        venueId,
        freshCount: initialStats.menuItems,
      });
    }
  }, [venueId, initialCounts, initialStats]); // Run when initial data changes

  const loadStats = useCallback(
    async (venueId: string, window: { startUtcISO: string; endUtcISO: string }) => {
      try {
        const supabase = createClient();

        // Normalize venueId format
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

        const loadStatsLogData = {
          venueId,
          normalizedVenueId,
          window,
          timestamp: new Date().toISOString(),
        };
        console.log("[DASHBOARD DATA] loadStats called:", JSON.stringify(loadStatsLogData, null, 2));

        const { data: orders } = await supabase
          .from("orders")
          .select("total_amount, order_status, payment_status")
          .eq("venue_id", normalizedVenueId)
          .gte("created_at", window.startUtcISO)
          .lt("created_at", window.endUtcISO)
          .neq("order_status", "CANCELLED")
          .neq("order_status", "REFUNDED");

        // Count ALL menu items (not just available) to match menu management count
        // ALWAYS use actual array length - it's the source of truth
        // Use EXACT same query as server component for consistency
        const { data: menuItems, error: menuError } = await supabase
          .from("menu_items")
          .select("id")
          .eq("venue_id", normalizedVenueId)
          .order("created_at", { ascending: false }); // Same ordering as server
          // Removed .eq("is_available", true) to match menu management count

        // ALWAYS use actual array length - it's the source of truth
        const finalMenuItemCount = menuItems?.length || 0;
        
        // Log to detect if loadStats is overriding initialStats
        console.warn("[DASHBOARD DATA] loadStats query result:", {
          count: finalMenuItemCount,
          arrayLength: menuItems?.length || 0,
          venueId: normalizedVenueId,
        });

        // Calculate revenue from all non-cancelled orders (regardless of payment status)
        const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        // Count unpaid orders based on payment_status, not order_status
        const unpaid =
          orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER")
            .length || 0;

        const newStats = {
          revenue,
          menuItems: finalMenuItemCount, // Use the count from count query
          unpaid,
        };
        
        // CRITICAL: If we have initialStats, NEVER override menuItems - server data is source of truth
        // This prevents the 178 vs 181 mismatch on first load
        if (hasInitialStats && initialStats) {
          console.warn("[DASHBOARD DATA] 🛑 loadStats would set menuItems to:", finalMenuItemCount);
          console.warn("[DASHBOARD DATA] 🛑 But hasInitialStats=true, keeping server count:", initialStats.menuItems);
          // Only update revenue and unpaid, ALWAYS keep menuItems from initialStats
          setStats({
            revenue,
            menuItems: initialStats.menuItems, // ALWAYS keep server-provided count
            unpaid,
          });
        } else {
          // LOG: Show what stats are being set
          console.warn("═══════════════════════════════════════════════════════════");
          console.warn("📝 [DASHBOARD DATA] Setting New Stats");
          console.warn("═══════════════════════════════════════════════════════════");
          console.warn("newStats object:", JSON.stringify(newStats, null, 2));
          console.warn("newStats.menuItems:", newStats.menuItems);
          console.warn("⚠️  This will update the displayed count");
          console.warn("═══════════════════════════════════════════════════════════");

          setStats(newStats);
        }

        // Cache the stats to prevent flicker - IMPORTANT: Key includes venueId
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(newStats));
        }
      } catch (_error) {
        // Error handled silently
      }
    },
    []
  );

  const refreshCounts = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();

      const { data: newCounts, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .rpc("dashboard_counts", {
              p_venue_id: venueId,
              p_tz: venueTz,
              p_live_window_mins: 30,
            })
            .single()
      );

      if (error) {
        logger.error("[Dashboard] Error fetching counts:", error);
        setError("Failed to refresh dashboard data");
        return;
      }

      // Fetch REAL table counts directly (no RPC, no caching)
      const { data: allTables } = await withSupabaseRetry(
        async () => await supabase.from("tables").select("id, is_active").eq("venue_id", venueId)
      );

      const { data: activeSessions } = await withSupabaseRetry(
        async () =>
          await supabase
            .from("table_sessions")
            .select("id")
            .eq("venue_id", venueId)
            .eq("status", "OCCUPIED")
            .is("closed_at", null)
      );

      const now = new Date();
      const { data: currentReservations } = await withSupabaseRetry(
        async () =>
          await supabase
            .from("reservations")
            .select("id")
            .eq("venue_id", venueId)
            .eq("status", "BOOKED")
            .lte("start_at", now.toISOString())
            .gte("end_at", now.toISOString())
      );

      if (newCounts && typeof newCounts === "object") {
        const counts = newCounts as DashboardCounts;

        // Merge real table counts
        const activeTables = allTables?.filter((t) => t.is_active) || [];
        const finalCounts = {
          ...counts,
          tables_set_up: activeTables.length, // Real count from tables table
          tables_in_use: activeSessions?.length || 0, // Real count from table_sessions
          tables_reserved_now: currentReservations?.length || 0, // Real count from reservations
          active_tables_count: activeTables.length, // Same as tables_set_up
        };

        setCounts(finalCounts);
        // Cache the counts using shared cache utility
        setCachedCounts(venueId, finalCounts);
      } else {
        logger.warn("[Dashboard] No counts data received from RPC");
      }
    } catch (_err) {
      logger.error("[Dashboard] Error refreshing counts:", _err);
      setError("Failed to refresh dashboard data");
    }
  }, [venueId, venueTz]);

  // Only refresh on mount if cache is stale or missing
  // DON'T refresh on every navigation - use cached data instead
  useEffect(() => {
    if (venueId) {
      // If we have fresh cache, use it and skip refresh
      if (isCacheFresh(venueId)) {
        const cached = getCachedCounts(venueId);
        if (cached) {
          setCounts({
            live_count: cached.live_count || 0,
            earlier_today_count: cached.earlier_today_count || 0,
            history_count: cached.history_count || 0,
            today_orders_count: cached.today_orders_count || 0,
            active_tables_count: cached.active_tables_count || 0,
            tables_set_up: cached.tables_set_up || 0,
            tables_in_use: cached.tables_in_use || 0,
            tables_reserved_now: cached.tables_reserved_now || 0,
          });
        }
        return;
      }

      // Only clear old venue's cache when switching venues (not on navigation)
      // This prevents clearing cache when just navigating between pages
      if (typeof window !== "undefined") {
        const allKeys = Object.keys(sessionStorage);
        allKeys.forEach((key) => {
          if (key.startsWith("dashboard_stats_")) {
            const cachedVenueId = key.split("_")[key.split("_").length - 1];
            if (cachedVenueId !== venueId) {
              sessionStorage.removeItem(key);
            }
          }
        });
      }

      // Only refresh if cache is stale or missing
      // This prevents unnecessary refreshes when navigating between pages
      refreshCounts();
    }
  }, [venueId]); // Only depend on venueId - don't include refreshCounts to prevent re-runs

  // Refresh data when page becomes visible (only if cache is stale)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && venueId) {
        // Only refresh if cache is stale - prevents unnecessary refreshes
        if (!isCacheFresh(venueId)) {
          refreshCounts();
        }
        const timeWindow = todayWindowForTZ(venueTz);
        if (timeWindow.startUtcISO && timeWindow.endUtcISO) {
          loadStats(venueId, {
            startUtcISO: timeWindow.startUtcISO,
            endUtcISO: timeWindow.endUtcISO,
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [venueId, venueTz, refreshCounts, loadStats]);

  const updateRevenueIncrementally = useCallback(
    (order: { order_status: string; total_amount?: number }) => {
      const totalAmount = typeof order.total_amount === "number" ? order.total_amount : 0;
      if (order.order_status !== "CANCELLED" && totalAmount > 0) {
        setStats((prev) => ({
          ...prev,
          revenue: prev.revenue + totalAmount,
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (!venue) return;

    const window = todayWindowForTZ(venueTz);
    setTodayWindow({
      startUtcISO: window.startUtcISO || "",
      endUtcISO: window.endUtcISO || "",
    });

    // If we have initial data from server, use it and DON'T fetch
    if (initialCounts && initialStats) {
      setLoading(false);
      return;
    }

    // No initial data - fetch immediately
    const fetchData = async () => {
      await refreshCounts();
      const venue_id =
        venue && typeof venue === "object" && "venue_id" in venue
          ? (venue as { venue_id: string }).venue_id
          : venueId;
      if (window.startUtcISO && window.endUtcISO) {
        await loadStats(venue_id, { startUtcISO: window.startUtcISO, endUtcISO: window.endUtcISO });
      }
      setLoading(false);
    };

    fetchData();
  }, [venue]);

  // Listen for menu changes to auto-refresh stats
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMenuChange = async (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; action: string; itemCount?: number }>;
      const changedVenueId = customEvent.detail?.venueId;
      
      console.log("═══════════════════════════════════════════════════════════");
      console.log("🔄 [DASHBOARD DATA] Menu change event received");
      console.log("═══════════════════════════════════════════════════════════");
      console.log("Event Venue ID:", changedVenueId);
      console.log("Current Venue ID:", venueId);
      console.log("Action:", customEvent.detail?.action || "unknown");
      console.log("Item Count:", customEvent.detail?.itemCount || "unknown");
      console.log("Timestamp:", new Date().toISOString());
      console.log("═══════════════════════════════════════════════════════════");

      // Normalize both venue IDs for comparison
      const normalizedChangedVenueId = changedVenueId?.startsWith("venue-") 
        ? changedVenueId 
        : changedVenueId ? `venue-${changedVenueId}` : null;
      const normalizedCurrentVenueId = venueId.startsWith("venue-") 
        ? venueId 
        : `venue-${venueId}`;

      if (normalizedChangedVenueId === normalizedCurrentVenueId) {
        console.log("🗑️ [DASHBOARD DATA] Clearing ALL caches...");
        
        // Clear all possible cache keys
        try {
          const allKeys = Object.keys(sessionStorage);
          allKeys.forEach((key) => {
            if (key.includes("dashboard_") && (key.includes(venueId) || key.includes(normalizedCurrentVenueId))) {
              sessionStorage.removeItem(key);
              console.log(`🗑️ Cleared: ${key}`);
            }
          });
        } catch (e) {
          console.error("[DASHBOARD DATA] Error clearing cache:", e);
        }
        
        console.log("🔄 [DASHBOARD DATA] Refreshing counts and stats...");
        
        // Force refresh counts
        await refreshCounts();
        
        // Force refresh stats - use todayWindow if available, otherwise create one
        const window = todayWindow || todayWindowForTZ(venueTz);
        const venue_id =
          venue && typeof venue === "object" && "venue_id" in venue
            ? (venue as { venue_id?: string }).venue_id
            : normalizedCurrentVenueId;
            
        if (venue_id && window.startUtcISO && window.endUtcISO) {
          await loadStats(venue_id, {
            startUtcISO: window.startUtcISO,
            endUtcISO: window.endUtcISO,
          });
        } else {
          // Fallback: directly query menu items count
          console.log("⚠️ [DASHBOARD DATA] No window available, querying menu items directly...");
          const supabase = createClient();
          const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
          // Count ALL menu items (not just available) to match menu management count
          const { data: menuItemsData, count, error: menuError } = await supabase
            .from("menu_items")
            .select("id", { count: "exact" })
            .eq("venue_id", normalizedVenueId);
            // Removed .eq("is_available", true) to match menu management count
          
          const finalCount = menuItemsData?.length || count || 0;
          
          console.log("[DASHBOARD DATA] Fallback query results:", {
            menuItemsArrayLength: menuItemsData?.length || 0,
            countFromCount: count || 0,
            finalCount,
            error: menuError?.message || null,
          });
          
          if (!menuError) {
            setStats((prev) => ({
              ...prev,
              menuItems: finalCount,
            }));
            console.log("✅ [DASHBOARD DATA] Menu items count updated directly:", finalCount);
          }
        }
        
        console.log("✅ [DASHBOARD DATA] Dashboard refreshed after menu change");
        console.log("═══════════════════════════════════════════════════════════");
      } else {
        console.log("⚠️ [DASHBOARD DATA] Venue ID mismatch, ignoring event");
      }
    };

    window.addEventListener("menuChanged", handleMenuChange);
    return () => {
      window.removeEventListener("menuChanged", handleMenuChange);
    };
  }, [venueId, venue, venueTz, todayWindow, refreshCounts, loadStats]);

  return {
    venue,
    setVenue,
    loading,
    setLoading,
    counts,
    setCounts,
    stats,
    setStats,
    todayWindow,
    error,
    setError,
    refreshCounts,
    loadStats,
    updateRevenueIncrementally,
  };
}
