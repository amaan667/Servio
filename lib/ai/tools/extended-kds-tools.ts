// Servio AI Assistant - Extended KDS Tools
// Station filtering, bulk updates, and advanced KDS queries

import { createAdminClient } from "@/lib/supabase";

interface StationTicketsResult {

  }>;

}

interface BulkTicketUpdateResult {

}

interface OverdueTicketsResult {

  }>;

}

/**
 * Get tickets for a specific station
 */
export async function getStationTickets(

  const { data: station, error: stationError } = await supabase
    .from("kds_stations")
    .select("id, station_name, station_type")
    .eq("venue_id", venueId)
    .ilike("station_name", `%${stationName}%`)
    .maybeSingle();

  if (stationError || !station) {
    // Try by station type if name not found
    const { data: stationByType } = await supabase
      .from("kds_stations")
      .select("id, station_name, station_type")
      .eq("venue_id", venueId)
      .ilike("station_type", `%${stationName}%`)
      .maybeSingle();

    if (!stationByType) {
      throw new Error(`Station "${stationName}" not found`);
    }

    // Use found station
    Object.assign(station || {}, stationByType);
  }

  // Get tickets for this station
  const { data: tickets, error: ticketsError } = await supabase
    .from("kds_tickets")
    .select("id, order_id, item_name, quantity, status, priority, created_at, station_id")
    .eq("venue_id", venueId)
    .eq("station_id", station!.id)
    .in("status", ["new", "in_progress", "ready"])
    .order("created_at", { ascending: true });

  if (ticketsError) {
    
    throw new Error(`Failed to fetch tickets: ${ticketsError.message}`);
  }

  const ticketList =
    tickets?.map((ticket) => {
      const timeInQueue = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);

      return {

        orderNumber: ticket.order_id.slice(0, 8),
        items: [`${ticket.quantity}x ${ticket.item_name}`],

        timeInQueue,
      };
    }) || [];

  return {

        ? `${station!.station_name} has ${ticketList.length} active tickets. Oldest: ${ticketList[0]?.timeInQueue} minutes in queue.`
        : `${station!.station_name} has no active tickets. All clear!`,
  };
}

/**
 * Bulk update ticket statuses (e.g., mark all ready tickets as bumped)
 */
export async function bulkUpdateTickets(

  stationName?: string
): Promise<BulkTicketUpdateResult> {
  const supabase = createAdminClient();

  

  const validStatuses = ["new", "in_progress", "ready", "bumped"];
  if (!validStatuses.includes(fromStatus) || !validStatuses.includes(toStatus)) {
    throw new Error(`Invalid status. Valid: ${validStatuses.join(", ")}`);
  }

  // Build query
  let query = supabase
    .from("kds_tickets")
    .update({

      ...(toStatus === "bumped" && { bumped_at: new Date().toISOString() }),
      ...(toStatus === "ready" && { ready_at: new Date().toISOString() }),

    .eq("venue_id", venueId)
    .eq("status", fromStatus);

  // Filter by station if provided
  if (stationName) {
    const { data: station } = await supabase
      .from("kds_stations")
      .select("id")
      .eq("venue_id", venueId)
      .ilike("station_name", `%${stationName}%`)
      .maybeSingle();

    if (station) {
      query = query.eq("station_id", station.id);
    }
  }

  const { data, error } = await query.select("id");

  if (error) {
    
    throw new Error(`Failed to update tickets: ${error.message}`);
  }

  return {

    message: `Updated ${data?.length || 0} tickets from ${fromStatus} to ${toStatus}${stationName ? ` at ${stationName} station` : ""}.`,
  };
}

/**
 * Get overdue KDS tickets
 */
export async function getOverdueKDSTickets(

  const { data: tickets, error } = await supabase
    .from("kds_tickets")
    .select("id, station_id, order_id, item_name, quantity, status, created_at")
    .eq("venue_id", venueId)
    .in("status", ["new", "in_progress"])
    .lt("created_at", thresholdTime)
    .order("created_at", { ascending: true });

  if (error) {
    
    throw new Error(`Failed to fetch overdue tickets: ${error.message}`);
  }

  // Get station names
  const stationIds = [...new Set(tickets?.map((t) => t.station_id) || [])];
  const { data: stations } = await supabase
    .from("kds_stations")
    .select("id, station_name")
    .in("id", stationIds);

  const stationMap = new Map(stations?.map((s) => [s.id, s.station_name]) || []);

  const overdueTickets =
    tickets?.map((ticket) => {
      const minutesOverdue = Math.floor(
        (Date.now() - new Date(ticket.created_at).getTime()) / 60000
      );

      return {

        orderNumber: ticket.order_id.slice(0, 8),
        items: [`${ticket.quantity}x ${ticket.item_name}`],
        minutesOverdue,

      };
    }) || [];

  return {

        ? `⚠️ ${overdueTickets.length} overdue tickets! Oldest: ${overdueTickets[0]?.minutesOverdue} minutes at ${overdueTickets[0]?.station}. Immediate attention needed!`

  };
}

/**
 * Get average prep time per station
 */
export async function getStationPrepTimes(venueId: string): Promise<{

  }>;

}> {
  const supabase = createAdminClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: tickets } = await supabase
    .from("kds_tickets")
    .select("station_id, created_at, ready_at, started_at")
    .eq("venue_id", venueId)
    .eq("status", "bumped")
    .gte("created_at", sevenDaysAgo.toISOString())
    .not("ready_at", "is", null);

  const { data: stations } = await supabase
    .from("kds_stations")
    .select("id, station_name")
    .eq("venue_id", venueId);

  const stationMap = new Map(stations?.map((s) => [s.id, s.station_name]) || []);
  const prepTimes = new Map<string, number[]>();

  tickets?.forEach((ticket) => {
    if (!ticket.started_at || !ticket.ready_at) return;

    const prepTime =
      (new Date(ticket.ready_at).getTime() - new Date(ticket.started_at).getTime()) / 60000;
    const stationName = stationMap.get(ticket.station_id) || "Unknown";

    if (!prepTimes.has(stationName)) {
      prepTimes.set(stationName, []);
    }
    prepTimes.get(stationName)!.push(prepTime);

  const stationStats = Array.from(prepTimes.entries()).map(([station, times]) => {
    const avgPrepTime = times.reduce((a, b) => a + b, 0) / times.length;
    let efficiency = "Good";
    if (avgPrepTime > 15) efficiency = "Slow";
    else if (avgPrepTime < 8) efficiency = "Excellent";

    return {
      station,

      efficiency,
    };

  return {

        ? `Average prep times: ${stationStats.map((s) => `${s.station} (${s.avgPrepTime} min)`).join(", ")}`

  };
}
