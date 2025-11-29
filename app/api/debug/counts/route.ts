import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venueId");
  
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }
  
  const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
  const supabase = createAdminClient();
  const venueTz = "Europe/London";
  const window = todayWindowForTZ(venueTz);
  
  // Log to Railway - use console.info
  console.info(`[RAILWAY] =================================================`);
  console.info(`[RAILWAY] DEBUG API: Fetching counts for ${normalizedVenueId}`);
  console.info(`[RAILWAY] =================================================`);
  
  // Fetch menu items
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id")
    .eq("venue_id", normalizedVenueId)
    .order("created_at", { ascending: false });
  
  const menuItemsCount = menuItems?.length || 0;
  
  console.info(`[RAILWAY] Menu Items: ${menuItemsCount}`);
  console.info(`[RAILWAY] Menu Items Error: ${menuError?.message || "None"}`);
  
  // Fetch tables
  const { data: allTables } = await supabase
    .from("tables")
    .select("id, is_active")
    .eq("venue_id", normalizedVenueId);
  
  const activeTables = allTables?.filter((t) => t.is_active) || [];
  const tablesCount = activeTables.length;
  
  console.info(`[RAILWAY] Tables Set Up: ${tablesCount}`);
  console.info(`[RAILWAY] Total Tables: ${allTables?.length || 0}`);
  
  // Fetch orders and revenue
  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, order_status, payment_status")
    .eq("venue_id", normalizedVenueId)
    .gte("created_at", window.startUtcISO || "")
    .lt("created_at", window.endUtcISO || "")
    .neq("order_status", "CANCELLED")
    .neq("order_status", "REFUNDED");
  
  const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
  const ordersCount = orders?.length || 0;
  
  console.info(`[RAILWAY] Revenue: £${revenue.toFixed(2)}`);
  console.info(`[RAILWAY] Orders Count: ${ordersCount}`);
  console.info(`[RAILWAY] =================================================`);
  
  return NextResponse.json({
    venueId: normalizedVenueId,
    database: {
      menuItems: menuItemsCount,
      tablesSetUp: tablesCount,
      revenue: revenue,
      ordersCount: ordersCount,
    },
    timestamp: new Date().toISOString(),
  });
}

