import KDSClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { getAuthFromMiddlewareHeaders } from "@/lib/auth/page-auth-helper";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

export default async function KDSPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Auth from middleware only (no per-page RPC) - no auth/rate-limit errors
  const auth = await getAuthFromMiddlewareHeaders();

  // Determine KDS tier from tier limits - matches TIER_LIMITS configuration
  const currentTier = auth?.tier ?? "starter";
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
    // CRITICAL: Get ALL OPEN orders - NO date restrictions - includes earlier today orders
    // Only OPEN orders need tickets (completed orders shouldn't have active tickets)
    try {
      // Step 1: Get ALL OPEN orders from this venue (no date filters - includes earlier today)
      const { data: allOrders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, venue_id, table_number, table_id, items, customer_name, order_status, payment_status, completion_status"
        )
        .eq("venue_id", venueId)
        .eq("completion_status", "OPEN") // Only backfill OPEN orders - completed orders don't need tickets
        .order("created_at", { ascending: false });

      if (ordersError) { /* Condition handled */ } else if (allOrders && allOrders.length > 0) {

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

          // Create tickets for each order
          let successCount = 0;
          let failCount = 0;

          for (const order of ordersWithoutTickets) {
            if (!order || !Array.isArray(order.items) || order.items.length === 0) {

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

            } catch (error) {
              failCount++;

            }
          }

        } else { /* Else case handled */ }
      } else { /* Else case handled */ }
    } catch (backfillError) {

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
      .neq("status", "bumped") // Exclude bumped tickets - they move to Live Orders
      .order("created_at", { ascending: true });

    if (ticketsError) { /* Condition handled */ } else if (tickets) {
      initialTickets = tickets;

    } else { /* Else case handled */ }
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
    />
  );
}
