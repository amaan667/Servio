import KDSClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

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
        // Error querying orders for backfill
      } else if (allOrders && allOrders.length > 0) {

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

              successCount++;
            } catch (error) {
              failCount++;
            }
          }
        }
      }
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
      .neq("status", "bumped")
      .order("created_at", { ascending: true });

    if (ticketsError) {
      // Error fetching tickets
    } else if (tickets) {
      initialTickets = tickets;
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
