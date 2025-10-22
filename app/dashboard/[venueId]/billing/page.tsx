import BillingClient from "./billing-client";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";

export default async function BillingPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createServerSupabase();

  // Safely get user without throwing errors
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user is the venue owner
  const { data: venue } = await supabase
    .from("venues")
    .select("venue_id, venue_name, owner_user_id")
    .eq("venue_id", venueId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  // Check if user has a staff role for this venue
  const { data: userRole } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  const isOwner = !!venue;
  const isStaff = !!userRole;

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    return <div>You don&apos;t have access to this venue</div>;
  }

  // Get venue details for staff
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

  const finalUserRole = userRole?.role || (isOwner ? "owner" : "staff");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={finalUserRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Billing & Subscription
          </h1>
          <p className="text-lg text-foreground mt-2">Manage your subscription and billing</p>
        </div>

        <BillingClient
          venueId={venueId}
          venueName={finalVenue?.venue_name || "Your Venue"}
          organization={{
            id: "temp-org",
            subscription_tier: "basic",
            subscription_status: "active",
            trial_ends_at: null,
          }}
          usage={{
            menuItems: 0,
            tables: 0,
            staff: 0,
            venues: 1,
          }}
        />
      </div>
    </div>
  );
}
