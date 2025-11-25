import KDSClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/supabase";
import { getPageAuthContext } from "@/lib/auth/unified-auth";
import { redirect } from "next/navigation";

export default async function KDSPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Server-side auth check
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) {
    redirect("/sign-in");
  }

  // Get tier and access info
  const authContext = await getPageAuthContext(user.id, venueId);
  if (!authContext || !authContext.venueAccess) {
    redirect("/dashboard");
  }

  // Check feature access server-side - KDS requires Enterprise tier
  const hasKDSAccess = authContext.hasFeatureAccess("kds");

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

    // Fetch active KDS tickets (not bumped)
    const { data: tickets } = await supabase
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
    
    if (tickets) {
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
      tier={authContext.tier}
      role={authContext.role}
      hasAccess={hasKDSAccess}
    />
  );
}
