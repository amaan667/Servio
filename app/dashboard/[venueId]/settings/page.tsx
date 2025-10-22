import VenueSettingsClient from "./VenueSettingsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";

export default async function VenueSettings({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createServerSupabase();

  // Safely get session with error handling for expired tokens
  let session = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch {
    // Silently handle refresh token errors - no logging needed
  }
  const user = session?.user;

  // If no user, return early with loading state - don't redirect
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userId = user.id;

  // Run all queries in parallel for faster loading
  const [venueResult, userRoleResult, allVenuesResult] = await Promise.all([
    supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .eq("owner_user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_venue_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("venue_id", venueId)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const venue = venueResult.data;
  const userRole = userRoleResult.data;
  const allVenues = allVenuesResult.data || [];

  const isOwner = !!venue;
  const isManager = userRole?.role === "manager";

  // Only owners and managers can access settings
  if (!isOwner && !isManager) {
    return <div>You don&apos;t have access to this venue</div>;
  }

  // Get venue details for manager
  let finalVenue = venue;
  if (!venue && isManager) {
    const { data: managerVenue } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();

    if (!managerVenue) {
      return <div>Venue not found</div>;
    }
    finalVenue = managerVenue;
  }

  // Get organization details
  const { data: organization } = await supabase
    .from("organizations")
    .select(
      "id, subscription_tier, is_grandfathered, stripe_customer_id, subscription_status, trial_ends_at"
    )
    .eq("id", finalVenue.organization_id)
    .single();

  const finalUserRole = userRole?.role || (isOwner ? "owner" : "staff");
  const canAccessSettings = finalUserRole === "owner" || finalUserRole === "manager";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={finalUserRole as "owner" | "manager" | "staff"}
          userName={user!.user_metadata?.full_name || user!.email?.split("@")[0] || "User"}
        />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Venue Settings</h1>
          <p className="text-lg text-foreground mt-2">Manage your venue settings and preferences</p>
        </div>

        {canAccessSettings ? (
          <VenueSettingsClient
            user={user as { id: string; email: string; user_metadata?: Record<string, unknown> }}
            venue={finalVenue}
            venues={allVenues}
            organization={organization || undefined}
            isOwner={isOwner}
          />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h3>
            <p className="text-yellow-700">
              You don&apos;t have permission to access settings. This feature is available for Owner
              and Manager roles only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
