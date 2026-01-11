import { createClient } from "@/lib/supabase";

export async function markPaid(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "PAID" })
    .eq("id", orderId);
  if (error) throw error;
}

export async function setOrderStatus(

  const { error } = await supabase.from("orders").update({ order_status: next }).eq("id", orderId);
  if (error) throw error;
}

// Helper function to get today bounds in UTC for a venue timezone
export function todayBounds(tz: string) {
  const now = new Date();
  const start = new Date(
    new Intl.DateTimeFormat("en-GB", {

    }).format(now) + " 00:00:00"
  );
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

// Fetch live orders (today's orders with active statuses)
export async function fetchLiveOrders(venueId: string, tz: string = "Europe/London") {
  const supabase = await createClient();
  const { startUtc, endUtc } = todayBounds(tz);
  const ACTIVE = ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"];

  return supabase
    .from("orders_with_totals")
    .select("*")
    .eq("venue_id", venueId)
    .in("order_status", ACTIVE)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc)
    .order("updated_at", { ascending: false });
}

// Fetch earlier today (today's orders with terminal statuses)
export async function fetchEarlierToday(venueId: string, tz: string = "Europe/London") {
  const supabase = await createClient();
  const { startUtc, endUtc } = todayBounds(tz);
  const TERMINAL_TODAY = ["COMPLETED", "SERVED", "CANCELLED", "REFUNDED", "EXPIRED"];

  return supabase
    .from("orders_with_totals")
    .select("*")
    .eq("venue_id", venueId)
    .in("order_status", TERMINAL_TODAY)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc)
    .order("created_at", { ascending: false });
}

// Fetch history (orders from previous days with SERVED status only)
export async function fetchHistory(venueId: string, tz: string = "Europe/London") {
  const supabase = await createClient();
  const { startUtc } = todayBounds(tz);

  return supabase
    .from("orders_with_totals")
    .select("*")
    .eq("venue_id", venueId)
    .eq("order_status", "SERVED")
    .lt("created_at", startUtc)
    .order("created_at", { ascending: false });
}
