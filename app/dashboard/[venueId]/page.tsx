import DashboardClient from "./page.client";
import { createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Fetch initial dashboard data on server to prevent "0" flicker
  let initialCounts = null;
  let initialStats = null;
  
  try {
    const supabase = await createClient();
    const venueTz = 'Europe/London';
    const window = todayWindowForTZ(venueTz);

    // Fetch dashboard counts
    const { data: countsData } = await supabase
      .rpc("dashboard_counts", {
        p_venue_id: venueId,
        p_tz: venueTz,
        p_live_window_mins: 30,
      })
      .single();

    if (countsData) {
      initialCounts = countsData;
    }

    // Fetch stats (revenue, menu items)
    const { data: orders } = await supabase
      .from("orders")
      .select("total_amount, order_status")
      .eq("venue_id", venueId)
      .gte("created_at", window.startUtcISO)
      .lt("created_at", window.endUtcISO)
      .neq("order_status", "CANCELLED");

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_available", true);

    const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

    initialStats = {
      revenue,
      menuItems: menuItems?.length || 0,
      unpaid,
    };
  } catch (error) {
    console.error("[DASHBOARD SSR] Failed to fetch initial data:", error);
    // Continue without initial data - client will load it
  }

  return <DashboardClient venueId={venueId} initialCounts={initialCounts} initialStats={initialStats} />;
}
