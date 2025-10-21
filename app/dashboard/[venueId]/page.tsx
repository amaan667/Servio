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

  // Safely get session with error handling for expired tokens
  let session = null;
  let sessionError = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
    sessionError = result.error;
  } catch (err) {
    // Silently handle refresh token errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (
      !errorMessage.includes("refresh_token_not_found") &&
      !errorMessage.includes("Invalid Refresh Token")
    ) {
      console.error("[DASHBOARD] Unexpected session error:", err);
    }
  }
  const user = session?.user;

  // Debug logging
  if (!user) {
    console.error("[DASHBOARD] No session found", {
      hasSession: !!session,
      sessionError,
      venueId,
    });
    // Show error message instead of redirecting
    const Link = (await import("next/link")).default;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-destructive mb-4">Session Error</h2>
          <p className="text-muted-foreground mb-4">
            Unable to verify your session. This may be due to an expired or invalid authentication
            token.
          </p>
          <Link
            href="/"
            className="block w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition text-center"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // User is guaranteed to be defined here after the check
  const userId = user.id;

  // Check if user is the venue owner
  const { data: venue } = await supabase
    .from("venues")
    .select("*")
    .eq("venue_id", venueId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  // Check if user has a staff role for this venue
  const { data: userRole } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .maybeSingle();

  const isOwner = !!venue;
  const isStaff = !!userRole;

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    return <div>You don&apos;t have access to this venue</div>;
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
