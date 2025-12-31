import KDSClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";
import { logger } from "@/lib/logger";

export default async function KDSPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - KDS is NOT included in Starter tier (available as add-on)
  // NO REDIRECTS - Dashboard always loads
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Check KDS access using the auth context's feature access helper
  // This properly checks tier limits: Starter = false, Pro = "advanced", Enterprise = "enterprise"
  const currentTier = auth?.tier ?? "starter";
  const hasKDSAccess = auth?.hasFeatureAccess("kds") ?? false;
  
  // Determine KDS tier from tier limits - matches TIER_LIMITS configuration
  const kdsTier: "advanced" | "enterprise" | false =
    currentTier === "enterprise" ? "enterprise" : currentTier === "pro" ? "advanced" : false;

  // Fetch initial KDS data on server to show accurate counts on first visit
  let initialTickets = null;
  let initialStations = null;

  try {
    const supabase = createAdminClient();

    // Fetch KDS stations
    const { data: stations } = await supabase
      .from("kds_stations")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (stations) {
      initialStations = stations;
    }

    // BACKFILL: Create tickets for existing orders that don't have them
    // CRITICAL: Get ALL orders - NO date restrictions, NO status filters - EVERY SINGLE ORDER
    try {
      // Step 1: Get ALL orders from this venue (no filters except venue_id)
      const { data: allOrders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, venue_id, table_number, table_id, items, customer_name, order_status, payment_status"
        )
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      if (ordersError) {
        logger.error("[KDS PAGE] Error querying orders for backfill:", {
          error: ordersError.message,
          venueId,
        });
      } else if (allOrders && allOrders.length > 0) {
        logger.info("[KDS PAGE] Found orders to check for tickets:", {
          count: allOrders.length,
          venueId,
        });

        // Step 2: Get all existing ticket order IDs for this venue
        const { data: existingTicketOrders } = await supabase
          .from("kds_tickets")
          .select("order_id")
          .eq("venue_id", venueId);

        const existingOrderIds = new Set(
          (existingTicketOrders || []).map((t: { order_id: string }) => t.order_id)
        );

        // Step 3: Filter to orders without tickets
        const ordersWithoutTickets = allOrders.filter((order) => !existingOrderIds.has(order.id));

        if (ordersWithoutTickets.length > 0) {
          logger.info("[KDS PAGE] Found orders without tickets, creating:", {
            count: ordersWithoutTickets.length,
            venueId,
            orderIds: ordersWithoutTickets.map((o) => o.id),
          });

          // Create tickets for each order
          let successCount = 0;
          let failCount = 0;

          for (const order of ordersWithoutTickets) {
            if (!order || !Array.isArray(order.items) || order.items.length === 0) {
              logger.debug("[KDS PAGE] Skipping order with no items:", { orderId: order?.id });
              continue;
            }

            try {
              await createKDSTicketsWithAI(supabase, {
                id: order.id,
                venue_id: order.venue_id,
                items: order.items,
                customer_name: order.customer_name,
                table_number: order.table_number,
                table_id: order.table_id,
              });
              successCount++;
              logger.info("[KDS PAGE] ✅ Created tickets for order:", {
                orderId: order.id,
                itemCount: order.items.length,
              });
            } catch (error) {
              failCount++;
              logger.error("[KDS PAGE] ❌ Failed to create tickets for order:", {
                orderId: order.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          logger.info("[KDS PAGE] Backfill completed:", {
            totalChecked: allOrders.length,
            withoutTickets: ordersWithoutTickets.length,
            success: successCount,
            failed: failCount,
            venueId,
          });
        } else {
          logger.debug("[KDS PAGE] All orders already have tickets", { venueId });
        }
      } else {
        logger.debug("[KDS PAGE] No orders found", { venueId });
      }
    } catch (backfillError) {
      logger.error("[KDS PAGE] Backfill error (non-critical):", {
        error: backfillError instanceof Error ? backfillError.message : String(backfillError),
        venueId,
      });
      // Continue - backfill is non-critical, client-side will handle it
    }

    // Fetch active KDS tickets (not bumped) after backfill
    // CRITICAL: Fetch ALL tickets from ALL orders - no date restrictions
    const { data: tickets, error: ticketsError } = await supabase
      .from("kds_tickets")
      .select(
        `
        *,
        kds_stations (
          id,
          station_name,
          station_type,
          color_code
        ),
        orders (
          id,
          customer_name,
          order_status,
          payment_status
        )
      `
      )
      .eq("venue_id", venueId)
      .neq("status", "bumped")
      .order("created_at", { ascending: true });

    if (ticketsError) {
      logger.error("[KDS PAGE] Error fetching tickets:", {
        error: ticketsError.message,
        venueId,
      });
    } else if (tickets) {
      initialTickets = tickets;
      logger.info("[KDS PAGE] ✅ Loaded initial tickets:", {
        count: tickets.length,
        venueId,
        statuses: tickets.map((t: { status: string }) => t.status),
      });
    } else {
      logger.warn("[KDS PAGE] No tickets found after backfill", { venueId });
    }
  } catch {
    // Continue without initial data - client will load it
  }

  return (
    <KDSClientPage
      venueId={venueId}
      initialTickets={initialTickets}
      initialStations={initialStations}
      tier={auth?.tier ?? "starter"}
      kdsTier={kdsTier}
      role={auth?.role ?? "viewer"}
      hasAccess={hasKDSAccess}
    />
  );
}
