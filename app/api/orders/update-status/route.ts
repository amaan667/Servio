import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, status } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { ok: false, error: "orderId and status required" },
        { status: 400 }
      );
    }

    // Create authenticated supabase client (respects RLS)
    const supabase = await createServerSupabase();

    // First verify the order belongs to a venue the user has access to
    const { data: orderCheck } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", orderId)
      .single();

    if (!orderCheck) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", orderCheck.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", orderCheck.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", orderId)
      .select();

    if (error) {
      logger.error("[UPDATE STATUS] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Deduct inventory stock when order is completed
    if (status === "COMPLETED") {
      const order = data?.[0];
      if (order) {
        try {
          // Call inventory deduction
          await supabase.rpc("deduct_stock_for_order", {
            p_order_id: orderId,
            p_venue_id: order.venue_id,
          });
        } catch (inventoryError) {
          logger.error("[INVENTORY] Error deducting stock:", { value: inventoryError });
          // Don't fail the order completion if inventory deduction fails
        }
      }
    }

    // Handle table state transitions when order is completed or cancelled
    if (status === "COMPLETED" || status === "CANCELLED") {
      const order = data?.[0];
      if (order && (order.table_id || order.table_number)) {
        // Use centralized table cleanup function
        const cleanupResult = await cleanupTableOnOrderCompletion({
          venueId: order.venue_id,
          tableId: order.table_id,
          tableNumber: order.table_number,
          orderId: orderId,
        });

        if (!cleanupResult.success) {
          logger.error("[ORDER UPDATE] Table cleanup failed:", cleanupResult.error);
        } else {
          // Block handled
        }

        // If order is completed and paid, check if reservations should be auto-completed
        if (status === "COMPLETED" && order.payment_status === "PAID") {
          try {
            const baseUrl =
              process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
            const completionResponse = await fetch(`${baseUrl}/api/reservations/check-completion`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                venueId: order.venue_id,
                tableId: order.table_id,
              }),
            });

            if (completionResponse.ok) {
              await completionResponse.json();
            }
          } catch (completionError) {
            logger.error("[UPDATE STATUS] Error checking reservation completion:", {
              value: completionError,
            });
            // Don't fail the main request if completion check fails
          }
        }
      }
    }

    return NextResponse.json({ ok: true, order: data?.[0] });
  } catch (_error) {
    logger.error("[UPDATE STATUS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
