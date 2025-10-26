import DashboardClient from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Fetch initial dashboard data on server WITHOUT auth (use admin client)
  let initialCounts = null;
  let initialStats = null;

  try {
    console.info("[DASHBOARD SSR] Fetching initial data for venueId:", venueId);
    const supabase = createAdminClient(); // Use admin client - no auth required!
    const venueTz = "Europe/London";
    const window = todayWindowForTZ(venueTz);

    console.info("[DASHBOARD SSR] Time window:", window);

    // Fetch dashboard counts using RPC
    console.info("[DASHBOARD SSR] Calling dashboard_counts RPC...");
    const { data: countsData, error: countsError } = await supabase
      .rpc("dashboard_counts", {
        p_venue_id: venueId,
        p_tz: venueTz,
        p_live_window_mins: 30,
      })
      .single();

    if (countsError) {
      console.error("[DASHBOARD SSR] dashboard_counts RPC failed:", countsError);
    } else {
      console.info("[DASHBOARD SSR] Counts fetched:", countsData);
      initialCounts = countsData;
    }

    // Fetch table counters to get accurate table counts
    console.info("[DASHBOARD SSR] Calling api_table_counters RPC...");
    const { data: tableCounters, error: tableError } = await supabase.rpc("api_table_counters", {
      p_venue_id: venueId,
    });

    if (tableError) {
      console.error("[DASHBOARD SSR] api_table_counters RPC failed:", tableError);
    } else {
      console.info("[DASHBOARD SSR] Table counters fetched:", tableCounters);

      // Merge table counters into counts
      if (
        initialCounts &&
        tableCounters &&
        Array.isArray(tableCounters) &&
        tableCounters.length > 0
      ) {
        initialCounts = {
          ...initialCounts,
          tables_set_up: tableCounters[0].tables_set_up || 0,
          tables_in_use: tableCounters[0].tables_in_use || 0,
          tables_reserved_now: tableCounters[0].tables_reserved_now || 0,
          active_tables_count: tableCounters[0].active_tables_count || 0,
        };
        console.info("[DASHBOARD SSR] Merged table counters:", initialCounts);
      }
    }

    // Fetch stats (revenue, menu items)
    console.info("[DASHBOARD SSR] Fetching orders for revenue...");
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total_amount, order_status")
      .eq("venue_id", venueId)
      .gte("created_at", window.startUtcISO)
      .lt("created_at", window.endUtcISO)
      .neq("order_status", "CANCELLED");

    if (ordersError) {
      console.error("[DASHBOARD SSR] Orders fetch failed:", ordersError);
    } else {
      console.info("[DASHBOARD SSR] Orders fetched:", orders?.length || 0);
    }

    console.info("[DASHBOARD SSR] Fetching menu items...");
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_available", true);

    if (menuError) {
      console.error("[DASHBOARD SSR] Menu items fetch failed:", menuError);
    } else {
      console.info("[DASHBOARD SSR] Menu items fetched:", menuItems?.length || 0);
    }

    const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

    initialStats = {
      revenue,
      menuItems: menuItems?.length || 0,
      unpaid,
    };

    console.info("[DASHBOARD SSR] Initial stats calculated:", initialStats);
    console.info("[DASHBOARD SSR] Initial counts final:", initialCounts);
  } catch (error) {
    console.error("[DASHBOARD SSR] Failed to fetch initial data:", error);
    // Continue without initial data - client will load it
  }

  console.info("[DASHBOARD SSR] Rendering client with data:", {
    hasCounts: !!initialCounts,
    hasStats: !!initialStats,
    countsValue: initialCounts,
    statsValue: initialStats,
  });

  return (
    <DashboardClient venueId={venueId} initialCounts={initialCounts} initialStats={initialStats} />
  );
}
