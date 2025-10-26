import DashboardClient from "./page.client";
import { createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Fetch initial dashboard data on server to prevent "0" flicker
  let initialCounts = null;
  let initialStats = null;

  try {
    console.info("[DASHBOARD SSR] Fetching initial data for venueId:", venueId);
    const supabase = await createClient();
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
  } catch (error) {
    console.error("[DASHBOARD SSR] Failed to fetch initial data:", error);
    // Continue without initial data - client will load it
  }

  console.info("[DASHBOARD SSR] Rendering client with initial data:", {
    hasCounts: !!initialCounts,
    hasStats: !!initialStats,
    counts: initialCounts,
    stats: initialStats,
  });

  return (
    <DashboardClient venueId={venueId} initialCounts={initialCounts} initialStats={initialStats} />
  );
}
