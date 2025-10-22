import InventoryClient from "./InventoryClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";

export default async function InventoryPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createServerSupabase();

  // Safely get user without throwing errors
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    const Link = (await import("next/link")).default;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-destructive mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to access this page.</p>
          <Link
            href="/sign-in"
            className="block w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition text-center"
          >
            Sign In
          </Link>
        </div>
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
  const canEditInventory = finalUserRole === "owner" || finalUserRole === "manager";

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
            Inventory Management
          </h1>
          <p className="text-lg text-foreground mt-2">
            {canEditInventory
              ? "Track ingredients, manage stock levels, and control costs"
              : "View inventory levels"}
          </p>
          {!canEditInventory && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Read-only mode:</strong> You can view inventory but cannot make changes.
                Only Owners and Managers can edit inventory.
              </p>
            </div>
          )}
        </div>

        <InventoryClient
          venueId={venueId}
          venueName={finalVenue?.venue_name || "Your Venue"}
          canEdit={canEditInventory}
        />
      </div>
    </div>
  );
}
