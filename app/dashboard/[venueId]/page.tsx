export const dynamic = "force-dynamic";

import React from "react";
import { createServerSupabase } from "@/lib/supabase";
import DashboardClient from "./page.client";
import { todayWindowForTZ } from "@/lib/time";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  const supabase = await createServerSupabase();

  if (!supabase) {
    return <div>Error: Unable to connect to database</div>;
  }

  // Try to get session but render page regardless
  let session = null;
  let user = null;
  let authError = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
    user = session?.user || null;
    authError = result.error;
  } catch (err) {
    authError = err;
    console.error("[Dashboard] Error getting session:", err);
  }

  // If no user, redirect to sign in
  if (!user) {
    console.log("[Dashboard] No user found, session:", session, "error:", authError);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-4">Please sign in to access this venue</p>
          <a href="/sign-in" className="text-blue-600 underline">Go to Sign In</a>
        </div>
      </div>
    );
  }

  const userId = user.id;

  // Check if user is the venue owner
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("*")
    .eq("venue_id", venueId)
    .eq("owner_id", userId)
    .maybeSingle();

  // Check if user has a staff role for this venue
  const { data: userRole, error: roleError } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .maybeSingle();

  const isOwner = !!venue;
  const isStaff = !!userRole;

  // Debug logging
  console.log("[Dashboard] Auth check:", {
    userId,
    venueId,
    isOwner,
    isStaff,
    venueError: venueError?.message,
    roleError: roleError?.message
  });

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="mb-4">You don&apos;t have access to this venue</p>
          <div className="text-xs text-gray-500 bg-gray-100 p-4 rounded">
            <p>User ID: {userId}</p>
            <p>Venue ID: {venueId}</p>
            <p>Owner Check: {venueError ? venueError.message : "No match"}</p>
            <p>Staff Check: {roleError ? roleError.message : "No match"}</p>
          </div>
        </div>
      </div>
    );
  }

  // If user is staff but not owner, get venue details
  let finalVenue = venue;
  if (!venue && isStaff) {
    const { data: staffVenue } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();

    if (!staffVenue) {
      return <div>Venue not found</div>;
    }
    finalVenue = staffVenue;
  }

  if (!finalVenue) {
    return <div>Venue not found</div>;
  }

  // Get dashboard counts
  const venueTz = "Europe/London";
  const { data: counts } = await supabase
    .rpc("dashboard_counts", {
      p_venue_id: venueId,
      p_tz: venueTz,
      p_live_window_mins: 30,
    })
    .single();

  // Get table counters
  const { data: tableCounters } = await supabase.rpc("api_table_counters", {
    p_venue_id: venueId,
  });

  // Use table counters data to override dashboard counts for consistency
  const tableCounter = tableCounters?.[0];
  if (tableCounter && counts) {
    const countsObj = counts as Record<string, unknown>;
    countsObj.tables_set_up = Number(tableCounter.total_tables) || 0;
    countsObj.tables_in_use = Number(tableCounter.occupied) || 0;
    countsObj.active_tables_count = Number(tableCounter.total_tables) || 0;
  }

  // Calculate today's revenue
  const todayWindow = todayWindowForTZ(venueTz);
  const { data: todayOrdersForRevenue } = await supabase
    .from("orders")
    .select("total_amount, order_status, payment_status, items")
    .eq("venue_id", venueId)
    .gte("created_at", todayWindow.startUtcISO)
    .lt("created_at", todayWindow.endUtcISO);

  const todayRevenue = (todayOrdersForRevenue ?? []).reduce(
    (sum: number, order: Record<string, unknown>) => {
      const orderData = order as {
        total_amount?: number | string;
        items?: Array<Record<string, unknown>>;
      };
      let amount =
        Number(orderData.total_amount) || parseFloat(String(orderData.total_amount)) || 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        if (Array.isArray(orderData.items)) {
          amount = orderData.items.reduce((s: number, it: Record<string, unknown>) => {
            const item = it as {
              unit_price?: number;
              price?: number;
              quantity?: number;
              qty?: number;
            };
            const unit = Number(item.unit_price ?? item.price ?? 0);
            const qty = Number(item.quantity ?? item.qty ?? 0);
            return s + (Number.isFinite(unit) && Number.isFinite(qty) ? unit * qty : 0);
          }, 0);
        }
      }
      return sum + amount;
    },
    0
  );

  // Get menu items count
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  const initialStats = {
    revenue: todayRevenue,
    menuItems: menuItems?.length || 0,
    unpaid: 0,
  };

  return (
    <DashboardClient
      venueId={venueId}
      venue={finalVenue}
      venueTz={venueTz}
      initialCounts={counts as Record<string, unknown>}
      initialStats={initialStats}
      userRole={userRole?.role || (isOwner ? "owner" : "staff")}
    />
  );
}
