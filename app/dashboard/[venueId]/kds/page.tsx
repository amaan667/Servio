import KDSClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";
import { logger } from "@/lib/logger";

export default async function KDSPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - KDS requires Enterprise tier
  // NO REDIRECTS - Dashboard always loads
  const auth = await requirePageAuth(venueId, {
    requireFeature: "kds",
  }).catch(() => null);

  const hasKDSAccess = auth?.hasFeatureAccess("kds") ?? false;

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
    // This ensures all existing orders have KDS tickets when the page loads
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Find orders without KDS tickets from today
      const { data: ordersWithoutTickets, error: queryError } = await supabase
        .from("orders")
        .select("id, venue_id, table_number, table_id, items, customer_name")
        .eq("venue_id", venueId)
        .in("payment_status", ["PAID", "UNPAID", "PAYMENT_PENDING"])
        .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "SERVED"])
        .gte("created_at", todayStart.toISOString())
        .not("id", "in", `(SELECT DISTINCT order_id FROM kds_tickets WHERE venue_id = '${venueId}')`);

      if (queryError) {
        logger.error("[KDS PAGE] Error querying orders for backfill:", {
          error: queryError.message,
          venueId,
        });
      } else if (ordersWithoutTickets && ordersWithoutTickets.length > 0) {
        logger.info("[KDS PAGE] Found orders without tickets, creating:", {
          count: ordersWithoutTickets.length,
          venueId,
          orderIds: ordersWithoutTickets.map(o => o.id),
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
            logger.info("[KDS PAGE] Created tickets for order:", {
              orderId: order.id,
              itemCount: order.items.length,
            });
          } catch (error) {
            failCount++;
            logger.error("[KDS PAGE] Failed to create tickets for order:", {
              orderId: order.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        logger.info("[KDS PAGE] Backfill completed:", {
          total: ordersWithoutTickets.length,
          success: successCount,
          failed: failCount,
          venueId,
        });
      }
    } catch (backfillError) {
      logger.error("[KDS PAGE] Backfill error (non-critical):", {
        error: backfillError instanceof Error ? backfillError.message : String(backfillError),
        venueId,
      });
      // Continue - backfill is non-critical, client-side will handle it
    }

    // Fetch active KDS tickets (not bumped) after backfill
    // Include all statuses: new, preparing, ready (but not bumped)
    const { data: tickets, error: ticketsError } = await supabase
      .from("kds_tickets")
      .select(`
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
      `)
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
      logger.debug("[KDS PAGE] Loaded initial tickets:", {
        count: tickets.length,
        venueId,
      });
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
      role={auth?.role ?? "viewer"}
      hasAccess={hasKDSAccess}
    />
  );
}
