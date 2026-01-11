import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface MenuItemLink {
  menu_item?:
    | {

      }
    | {

      }[];
}

// GET /api/inventory/low-stock?venue_id=xxx
export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {

          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const adminSupabase = createAdminClient();

    // Get ingredients at or below reorder level
    const { data: lowStockItems, error } = await adminSupabase
      .from("v_stock_levels")
      .select("*")
      .eq("venue_id", context.venueId)
      .or("on_hand.lte.reorder_level,on_hand.lte.0")
      .order("on_hand", { ascending: true });

    if (error) {
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For each low stock item, find affected menu items
    const alerts = await Promise.all(
      (lowStockItems || []).map(async (item) => {
        const { data: menuItems } = await adminSupabase
          .from("menu_item_ingredients")
          .select("menu_item_id, menu_item:menu_items(name)")
          .eq("ingredient_id", item.ingredient_id);

        return {

                }
                return menuItem?.name;

              .filter(Boolean) || [],
        };

    );

    return NextResponse.json({ data: alerts });
  } catch (_error) {
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
