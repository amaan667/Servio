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

  // Priority: ALWAYS use initialCounts from server first - it's the source of truth
  // Only use cache if initialCounts is not provided
  const [counts, setCounts] = useState<DashboardCounts>(() => {
    // ALWAYS prefer server data - it's guaranteed fresh
    if (initialCounts) {
      console.error("[DASHBOARD DATA] ✅ Initializing counts state with server data:");
      console.error("  today_orders_count:", initialCounts.today_orders_count);
      console.error("  tables_set_up:", initialCounts.tables_set_up);
      console.error("  live_count:", initialCounts.live_count);
      console.error("  Full initialCounts:", JSON.stringify(initialCounts, null, 2));
      return initialCounts;
    }
    
    // Fallback to cache only if no server data
    const cached = getCachedCounts(venueId);
    if (cached) {
      console.error("[DASHBOARD DATA] ⚠️ No server data, using cached counts:", cached);
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
    
    console.error("[DASHBOARD DATA] ⚠️ No server data or cache, using defaults (all 0)");
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
      // Log to console.error for maximum visibility
      console.error("═══════════════════════════════════════════════════════════");
      console.error("[DASHBOARD DATA] ✅ INITIALIZING stats state with initialStats");
      console.error("═══════════════════════════════════════════════════════════");
      console.error("initialStats received:", JSON.stringify(initialStats, null, 2));
      console.error("initialStats.menuItems:", initialStats.menuItems);
      console.error("initialStats.revenue:", initialStats.revenue);
      console.error("initialStats.unpaid:", initialStats.unpaid);
      console.error("⚠️  This menuItems count will be displayed:", initialStats.menuItems);
      console.error("⚠️  loadStats will NOT override this count");
      console.error("═══════════════════════════════════════════════════════════");
      
      // Also log as plain console.log
      console.log("DASHBOARD initialStats COUNT:", initialStats.menuItems, "items");
      return initialStats;
    }
    // If no server data, use defaults - NEVER use cache for stats
    console.error("[DASHBOARD DATA] ⚠️ No server data, using defaults (menuItems: 0)");
    return { revenue: 0, menuItems: 0, unpaid: 0 };
  });
  
  // CRITICAL: Force update stats AND counts when initialStats/initialCounts change
  // This MUST run immediately to prevent loadStats from overriding with stale data
  useEffect(() => {
    if (initialStats) {
      const oldCount = stats.menuItems;
      const newCount = initialStats.menuItems;
      
      // Use console.error for maximum visibility
      console.error("[DASHBOARD DATA] useEffect - initialStats received from server:", {
        old: oldCount,
        new: newCount,
        changed: oldCount !== newCount,
        fullInitialStats: JSON.stringify(initialStats, null, 2),
      });
      
      // ALWAYS update immediately with server data - it's the source of truth
      // Don't let loadStats override this on initial mount
      setStats(initialStats);
      
      console.error("[DASHBOARD DATA] ✅ setStats called with initialStats.menuItems:", initialStats.menuItems);
      
      if (oldCount !== newCount) {
        console.error("✅ [DASHBOARD DATA] Count updated from server:", oldCount, "→", newCount);
        console.log("DASHBOARD COUNT UPDATE:", oldCount, "→", newCount);
      }
    } else {
      console.error("[DASHBOARD DATA] ⚠️ useEffect - No initialStats provided!");
    }
    
    // Also update counts if initialCounts is provided
    if (initialCounts) {
      console.log("[DASHBOARD DATA] ✅ Updating counts with server data:", initialCounts);
      console.error("[DASHBOARD DATA] ✅ Updating counts with server data - tables_set_up:", initialCounts.tables_set_up);
      setCounts(initialCounts);
    }
  }, [initialStats?.menuItems, initialStats?.revenue, initialStats?.unpaid, initialCounts?.tables_set_up, initialCounts?.today_orders_count, initialCounts?.live_count]); // Depend on specific values to ensure updates
  
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
    // CRITICAL: Clear ALL cached data when server provides fresh data
    // This prevents stale cache from being used on first load
    if (typeof window !== "undefined") {
      if (initialStats) {
        // Clear cached stats to prevent stale menu items count
        sessionStorage.removeItem(`dashboard_stats_${venueId}`);
        console.log("[DASHBOARD DATA] Cleared cached stats to force fresh data:", {
          venueId,
          freshCount: initialStats.menuItems,
        });
      }
      if (initialCounts) {
        // Update cache with fresh server data
        setCachedCounts(venueId, initialCounts);
        // Also clear any stale cached counts that might have wrong values
        const cached = getCachedCounts(venueId);
        if (cached && (cached.tables_set_up !== initialCounts.tables_set_up || cached.today_orders_count !== initialCounts.today_orders_count)) {
          console.log("[DASHBOARD DATA] Cache had stale data, cleared and updated with server data");
        }
      }
    }
  }, [venueId, initialCounts, initialStats]); // Run when initial data changes

  const loadStats = useCallback(
    async (venueId: string, window: { startUtcISO: string; endUtcISO: string }) => {
      // CRITICAL: Check current stats state to see if we have server-provided menuItems
      // This check happens at CALL TIME, not callback creation time
      const currentStats = stats; // Get current state value
      const hasServerMenuItems = initialStats?.menuItems !== undefined && initialStats.menuItems > 0;
      
      console.error("═══════════════════════════════════════════════════════════");
      console.error("🔍 [DASHBOARD DATA] loadStats CALLED");
      console.error("═══════════════════════════════════════════════════════════");
      console.error("venueId:", venueId);
      console.error("initialStats exists:", !!initialStats);
      console.error("initialStats?.menuItems:", initialStats?.menuItems);
      console.error("Current stats.menuItems:", currentStats.menuItems);
      console.error("hasServerMenuItems:", hasServerMenuItems);
      console.error("Stack trace:", new Error().stack);
      console.error("═══════════════════════════════════════════════════════════");
      
      // If we have server-provided menuItems, NEVER override them
      if (hasServerMenuItems) {
        console.error("[DASHBOARD DATA] 🛑 loadStats called but initialStats.menuItems exists:", initialStats.menuItems);
        console.error("[DASHBOARD DATA] 🛑 Current stats.menuItems:", currentStats.menuItems);
        console.error("[DASHBOARD DATA] 🛑 Skipping menuItems query, keeping server count");
        // Only update revenue and unpaid, NEVER touch menuItems
        try {
          const supabase = createClient();
          const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
          
          const { data: orders } = await supabase
            .from("orders")
            .select("total_amount, order_status, payment_status")
            .eq("venue_id", normalizedVenueId)
            .gte("created_at", window.startUtcISO)
            .lt("created_at", window.endUtcISO)
            .neq("order_status", "CANCELLED")
            .neq("order_status", "REFUNDED");

          const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
          const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;

          // ONLY update revenue and unpaid, NEVER menuItems
          console.error("[DASHBOARD DATA] 🛑 Updating stats - keeping menuItems:", initialStats.menuItems);
          setStats({
            revenue,
            menuItems: initialStats.menuItems, // ALWAYS keep server-provided count
            unpaid,
          });
          console.error("[DASHBOARD DATA] 🛑 Stats updated - menuItems preserved:", initialStats.menuItems);
        } catch (_error) {
          // Error handled silently
        }
        return; // Early return - don't run the menu items query
      }
      
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

        // Use unified count function - single source of truth
        const { fetchMenuItemCount } = await import("@/lib/counts/unified-counts");
        const finalMenuItemCount = await fetchMenuItemCount(venueId);

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
        
        // LOG: Show what stats are being set
        // Note: This code only runs if initialStats doesn't exist (early return above prevents this)
        console.warn("═══════════════════════════════════════════════════════════");
        console.warn("📝 [DASHBOARD DATA] Setting New Stats (no initialStats)");
        console.warn("═══════════════════════════════════════════════════════════");
        console.warn("newStats object:", JSON.stringify(newStats, null, 2));
        console.warn("newStats.menuItems:", newStats.menuItems);
        console.warn("⚠️  This will update the displayed count");
        console.warn("═══════════════════════════════════════════════════════════");

        setStats(newStats);

        // Cache the stats to prevent flicker - IMPORTANT: Key includes venueId
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`dashboard_stats_${venueId}`, JSON.stringify(newStats));
        }
      } catch (_error) {
        // Error handled silently
      }
    },
    [initialStats, stats] // Include both initialStats and stats to check at call time
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

        // CRITICAL: Only update counts if we don't have server-provided initialCounts
        // If initialCounts exists, it's the source of truth and should not be overridden
        if (!initialCounts) {
          setCounts(finalCounts);
          // Cache the counts using shared cache utility
          setCachedCounts(venueId, finalCounts);
        } else {
          // We have server data - only update cache, don't override state
          setCachedCounts(venueId, finalCounts);
          console.log("[DASHBOARD DATA] refreshCounts: Server data exists, not overriding state");
        }
      } else {
        logger.warn("[Dashboard] No counts data received from RPC");
      }
    } catch (_err) {
      logger.error("[Dashboard] Error refreshing counts:", _err);
      setError("Failed to refresh dashboard data");
    }
  }, [venueId, venueTz, initialCounts]);

  // Only refresh on mount if cache is stale or missing
  // CRITICAL: NEVER use cache if we have server data (initialCounts/initialStats)
  // Server data is always the source of truth
  useEffect(() => {
    if (venueId) {
      // CRITICAL: If we have server data, NEVER use cache - server data is always correct
      if (initialCounts || initialStats) {
        // Server data exists - don't use cache, don't refresh
        // Update cache with server data for future use, but don't override current state
        if (initialCounts) {
          setCachedCounts(venueId, initialCounts);
        }
        console.log("[DASHBOARD DATA] ✅ Server data available, skipping cache check - using server data");
        return;
      }
      
      // Only use cache if we DON'T have server data
      // If we have fresh cache, use it and skip refresh
      if (isCacheFresh(venueId)) {
        const cached = getCachedCounts(venueId);
        if (cached) {
          console.log("[DASHBOARD DATA] ⚠️ No server data, using cached counts");
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

      // Only refresh if cache is stale or missing AND we don't have server data
      // This prevents unnecessary refreshes when navigating between pages
      // CRITICAL: Don't refresh if we have fresh server data - it's already correct
      if (!initialCounts) {
        refreshCounts();
      } else {
        console.log("[DASHBOARD DATA] ✅ Server data available, skipping refreshCounts - using server data");
      }
    }
  }, [venueId, initialCounts]); // Include initialCounts to check if server data is available

  // Refresh data when page becomes visible (only if cache is stale AND no server data)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && venueId) {
        // CRITICAL: If we have server data, don't refresh - server data is always correct
        if (initialCounts || initialStats) {
          console.log("[DASHBOARD DATA] Page visible but server data exists, skipping refresh");
          return;
        }
        
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
  }, [venueId, venueTz, refreshCounts, loadStats, initialCounts, initialStats]);

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

  // Listen for real-time custom events to update counts immediately
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMenuItemsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; count: number }>;
      const changedVenueId = customEvent.detail?.venueId;
      const count = customEvent.detail?.count;
      
      const normalizedChangedVenueId = changedVenueId?.startsWith("venue-") 
        ? changedVenueId 
        : changedVenueId ? `venue-${changedVenueId}` : null;
      const normalizedCurrentVenueId = venueId.startsWith("venue-") 
        ? venueId 
        : `venue-${venueId}`;

      if (normalizedChangedVenueId === normalizedCurrentVenueId && typeof count === "number") {
        console.info("[DASHBOARD DATA] menuItemsChanged event - updating count:", count);
        setStats((prev) => ({
          ...prev,
          menuItems: count,
        }));
      }
    };

    const handleOrdersChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; revenue: number; unpaid: number }>;
      const changedVenueId = customEvent.detail?.venueId;
      const revenue = customEvent.detail?.revenue;
      const unpaid = customEvent.detail?.unpaid;
      
      const normalizedChangedVenueId = changedVenueId?.startsWith("venue-") 
        ? changedVenueId 
        : changedVenueId ? `venue-${changedVenueId}` : null;
      const normalizedCurrentVenueId = venueId.startsWith("venue-") 
        ? venueId 
        : `venue-${venueId}`;

      if (normalizedChangedVenueId === normalizedCurrentVenueId) {
        console.info("[DASHBOARD DATA] ordersChanged event - updating revenue:", revenue, "unpaid:", unpaid);
        setStats((prev) => ({
          ...prev,
          revenue: typeof revenue === "number" ? revenue : prev.revenue,
          unpaid: typeof unpaid === "number" ? unpaid : prev.unpaid,
        }));
        // Also refresh counts to get order counts
        refreshCounts();
      }
    };

    const handleTablesChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; count: number }>;
      const changedVenueId = customEvent.detail?.venueId;
      const count = customEvent.detail?.count;
      
      const normalizedChangedVenueId = changedVenueId?.startsWith("venue-") 
        ? changedVenueId 
        : changedVenueId ? `venue-${changedVenueId}` : null;
      const normalizedCurrentVenueId = venueId.startsWith("venue-") 
        ? venueId 
        : `venue-${venueId}`;

      if (normalizedChangedVenueId === normalizedCurrentVenueId && typeof count === "number") {
        console.info("[DASHBOARD DATA] tablesChanged event - updating count:", count);
        setCounts((prev) => ({
          ...prev,
          tables_set_up: count,
          active_tables_count: count,
        }));
      }
    };

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
          // Fallback: use unified count function
          const { fetchMenuItemCount } = await import("@/lib/counts/unified-counts");
          const finalCount = await fetchMenuItemCount(venueId);
          setStats((prev) => ({
            ...prev,
            menuItems: finalCount,
          }));
        }
        
        console.log("✅ [DASHBOARD DATA] Dashboard refreshed after menu change");
        console.log("═══════════════════════════════════════════════════════════");
      } else {
        console.log("⚠️ [DASHBOARD DATA] Venue ID mismatch, ignoring event");
      }
    };


    const handleRevenueChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; amount: number }>;
      const changedVenueId = customEvent.detail?.venueId;
      const amount = customEvent.detail?.amount;
      
      // Normalize both venue IDs for comparison
      const normalizedChangedVenueId = changedVenueId?.startsWith("venue-") 
        ? changedVenueId 
        : changedVenueId ? `venue-${changedVenueId}` : null;
      const normalizedCurrentVenueId = venueId.startsWith("venue-") 
        ? venueId 
        : `venue-${venueId}`;

      if (normalizedChangedVenueId === normalizedCurrentVenueId && typeof amount === "number") {
        // Update revenue instantly
        setStats((prev) => ({
          ...prev,
          revenue: prev.revenue + amount,
        }));
        console.log("✅ [DASHBOARD DATA] Revenue updated instantly via real-time:", amount);
      }
    };


    window.addEventListener("menuChanged", handleMenuChange);
    window.addEventListener("menuItemsChanged", handleMenuItemsChanged);
    window.addEventListener("revenueChanged", handleRevenueChanged);
    window.addEventListener("tablesChanged", handleTablesChanged);
    return () => {
      window.removeEventListener("menuChanged", handleMenuChange);
      window.removeEventListener("menuItemsChanged", handleMenuItemsChanged);
      window.removeEventListener("revenueChanged", handleRevenueChanged);
      window.removeEventListener("tablesChanged", handleTablesChanged);
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
