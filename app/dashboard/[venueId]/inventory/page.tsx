/**
 * Inventory Page - Server Component
 * Provides server-side data fetching for inventory management
 */

import { createAdminClient } from "@/lib/supabase";
import InventoryClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { logger } from "@/lib/monitoring/structured-logger";
import type { StockLevel } from "@/types/inventory";

export const metadata = {
  title: "Inventory | Servio",
  description: "Track and manage your inventory",
};

interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
}

export default async function InventoryPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - NO REDIRECTS - Dashboard always loads
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch inventory data on server
  const [initialInventory, stats] = await Promise.all([
    fetchInventoryItems(venueId),
    calculateInventoryStats(venueId),
  ]);

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Inventory",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <InventoryClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
        initialInventory={initialInventory}
        initialStats={stats}
      />
    </>
  );
}

/**
 * Fetch inventory items from the database
 */
async function fetchInventoryItems(venueId: string): Promise<StockLevel[]> {
  const startTime = Date.now();
  
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from("v_stock_levels")
      .select("*")
      .eq("venue_id", venueId)
      .order("name", { ascending: true });

    if (error) {
      logger.error("Failed to fetch inventory items", {
        venueId,
        error: error.message,
      });
      return [];
    }

    logger.debug("Fetched inventory items", {
      venueId,
      count: data?.length || 0,
      duration: Date.now() - startTime,
    });

    return (data as StockLevel[]) || [];
  } catch (error) {
    logger.error("Error fetching inventory items", {
      venueId,
      error: error instanceof Error ? error.message : "Unknown error",
    }, error as Error);
    return [];
  }
}

/**
 * Calculate inventory statistics from fetched items
 */
async function calculateInventoryStats(venueId: string): Promise<InventoryStats> {
  const startTime = Date.now();
  
  try {
    const supabase = createAdminClient();
    
    const { data: ingredients, error } = await supabase
      .from("v_stock_levels")
      .select("on_hand, reorder_level, cost_per_unit")
      .eq("venue_id", venueId);

    if (error) {
      logger.error("Failed to calculate inventory stats", {
        venueId,
        error: error.message,
      });
      return {
        totalItems: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalValue: 0,
      };
    }

    const items = ingredients || [];
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValue = 0;

    items.forEach((item) => {
      const onHand = item.on_hand || 0;
      const reorderLevel = item.reorder_level || 0;
      const costPerUnit = item.cost_per_unit || 0;

      // Calculate total value
      totalValue += onHand * costPerUnit;

      // Check stock levels
      if (onHand <= 0) {
        outOfStockCount++;
      } else if (onHand <= reorderLevel && reorderLevel > 0) {
        lowStockCount++;
      }
    });

    const stats: InventoryStats = {
      totalItems: items.length,
      lowStockItems: lowStockCount,
      outOfStockItems: outOfStockCount,
      totalValue,
    };

    logger.debug("Calculated inventory stats", {
      venueId,
      stats,
      duration: Date.now() - startTime,
    });

    return stats;
  } catch (error) {
    logger.error("Error calculating inventory stats", {
      venueId,
      error: error instanceof Error ? error.message : "Unknown error",
    }, error as Error);
    return {
      totalItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      totalValue: 0,
    };
  }
}
