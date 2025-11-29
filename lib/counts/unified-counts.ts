/**
 * Unified Count System
 * All counts should be fetched from the same source and update in real-time
 */

import { supabaseBrowser as createClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

export interface UnifiedCounts {
  menuItems: number;
  liveOrders: number;
  todayOrders: number;
  revenue: number;
  unpaid: number;
}

/**
 * Fetch menu item count - same query logic used everywhere
 */
export async function fetchMenuItemCount(venueId: string): Promise<number> {
  const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
  const supabase = createClient();
  
  const { data: menuItems, error } = await supabase
    .from("menu_items")
    .select("id")
    .eq("venue_id", normalizedVenueId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[UNIFIED COUNTS] Error fetching menu items:", error);
    return 0;
  }
  
  return menuItems?.length || 0;
}

/**
 * Fetch all unified counts for dashboard
 */
export async function fetchUnifiedCounts(
  venueId: string,
  venueTz: string = "Europe/London"
): Promise<UnifiedCounts> {
  const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
  const supabase = createClient();
  const window = todayWindowForTZ(venueTz);
  
  // Fetch menu items count
  const menuItems = await fetchMenuItemCount(venueId);
  
  // Fetch dashboard counts using RPC
  const { data: countsData } = await supabase
    .rpc("dashboard_counts", {
      p_venue_id: normalizedVenueId,
      p_tz: venueTz,
      p_live_window_mins: 30,
    })
    .single();
  
  const liveOrders = (countsData as { live_count?: number })?.live_count || 0;
  const todayOrders = (countsData as { today_orders_count?: number })?.today_orders_count || 0;
  
  // Fetch revenue and unpaid
  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, payment_status")
    .eq("venue_id", normalizedVenueId)
    .gte("created_at", window.startUtcISO || "")
    .lt("created_at", window.endUtcISO || "")
    .neq("order_status", "CANCELLED")
    .neq("order_status", "REFUNDED");
  
  const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
  const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;
  
  return {
    menuItems,
    liveOrders,
    todayOrders,
    revenue,
    unpaid,
  };
}

/**
 * Set up real-time subscription for menu items changes
 */
export function subscribeToMenuItemsChanges(
  venueId: string,
  onUpdate: (count: number) => void
): () => void {
  const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
  const supabase = createClient();
  
  const channel = supabase
    .channel(`menu-items-${venueId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "menu_items",
        filter: `venue_id=eq.${normalizedVenueId}`,
      },
      async () => {
        // Debounce to prevent excessive calls
        const count = await fetchMenuItemCount(venueId);
        onUpdate(count);
        
        // Dispatch custom event for other components
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("menuItemsChanged", {
              detail: { venueId, count },
            })
          );
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Set up real-time subscription for orders changes
 */
export function subscribeToOrdersChanges(
  venueId: string,
  onUpdate: (counts: { liveOrders: number; todayOrders: number; revenue: number; unpaid: number }) => void
): () => void {
  const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
  const supabase = createClient();
  
  let debounceTimeout: NodeJS.Timeout | null = null;
  
  const refreshCounts = async () => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      const counts = await fetchUnifiedCounts(venueId);
      onUpdate({
        liveOrders: counts.liveOrders,
        todayOrders: counts.todayOrders,
        revenue: counts.revenue,
        unpaid: counts.unpaid,
      });
      
      // Dispatch custom event for other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ordersChanged", {
            detail: { venueId, counts },
          })
        );
      }
    }, 500);
  };
  
  const channel = supabase
    .channel(`orders-${venueId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `venue_id=eq.${normalizedVenueId}`,
      },
      refreshCounts
    )
    .subscribe();
  
  return () => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    supabase.removeChannel(channel);
  };
}

