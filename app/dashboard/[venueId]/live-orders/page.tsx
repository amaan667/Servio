import LiveOrdersClientPage from "./page.client";
import { requireDashboardAccess } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForLocal } from "@/lib/dates";
import { logger } from "@/lib/logger";
import type { Order } from "./types";

interface LiveOrderStats {
  pending: number;
  preparing: number;
  ready: number;
  serving: number;
  totalRevenue: number;
}

async function fetchLiveOrders(venueId: string): Promise<Order[]> {
  const supabase = createAdminClient();
  const todayWindowData = todayWindowForLocal();
  const todayStart = todayWindowData.startUtcISO || new Date().toISOString();
  
  // Fetch live orders (active statuses within today's window)
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED", "COMPLETED"])
    .gte("created_at", todayStart)
    .in("payment_status", ["PAID", "UNPAID"])
    .order("created_at", { ascending: false })
    .limit(100);
  
  if (error) {
    logger.error("Failed to fetch live orders for SSR", {
      venueId,
      error: error.message,
      code: error.code,
    });
    return [];
  }
  
  return (orders || []) as unknown as Order[];
}

function calculateLiveOrderStats(orders: Order[]): LiveOrderStats {
  const stats: LiveOrderStats = {
    pending: 0,
    preparing: 0,
    ready: 0,
    serving: 0,
    totalRevenue: 0,
  };
  
  for (const order of orders) {
    // Count by status
    switch (order.order_status) {
      case "PLACED":
        stats.pending++;
        break;
      case "IN_PREP":
        stats.preparing++;
        break;
      case "READY":
        stats.ready++;
        break;
      case "SERVING":
      case "SERVED":
        stats.serving++;
        break;
    }
    
    // Add to revenue (only paid orders)
    if (order.payment_status === "PAID") {
      stats.totalRevenue += order.total_amount || 0;
    }
  }
  
  return stats;
}

export default async function LiveOrdersPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requireDashboardAccess(venueId);

  // Fetch initial live orders on server for instant load (no flicker)
  let initialOrders: Order[] = [];
  let initialStats: LiveOrderStats | undefined;

  try {
    initialOrders = await fetchLiveOrders(auth.venueId);
    
    if (initialOrders.length > 0) {
      initialStats = calculateLiveOrderStats(initialOrders);
    }
    
    logger.info("SSR live orders fetched successfully", {
      venueId,
      orderCount: initialOrders.length,
      stats: initialStats,
    });
  } catch (error) {
    logger.error("Error fetching live orders for SSR", {
      venueId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Continue without initial data - client will load it
  }

  // Log auth information for browser console
  const authInfo = {
    hasAuth: auth.isAuthenticated,
    userId: auth.userId,
    email: auth.email,
    tier: auth.tier,
    role: auth.role,
    venueId: auth.venueId,
    timestamp: new Date().toISOString(),
    page: "LiveOrders",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <LiveOrdersClientPage venueId={venueId} />
    </>
  );
}
