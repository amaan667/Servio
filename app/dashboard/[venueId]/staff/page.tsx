import InvitationBasedStaffManagement from "@/components/staff/InvitationBasedStaffManagement";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { createServerSupabase } from "@/lib/supabase";

export default async function StaffPage({ params }: { params: Promise<{ venueId: string }> }) {
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

  // Check if user has access to this venue (owner or has role)
  const { data: userRole } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .single();

  // Also check if user is the venue owner (for backward compatibility)
  const { data: venue } = await supabase
    .from("venues")
    .select("venue_id, venue_name, owner_id")
    .eq("venue_id", venueId)
    .single();

  const isOwner = venue?.owner_id === user.id;
  const isStaff = !!userRole;

  if (!venue || (!isOwner && !isStaff)) {
    return <div>You don&apos;t have access to this venue</div>;
  }

  const finalUserRole = userRole?.role || (isOwner ? "owner" : "staff");
  const canManageStaff = finalUserRole === "owner" || finalUserRole === "manager";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={finalUserRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
        />

        {canManageStaff ? (
          <InvitationBasedStaffManagement
            venueId={venueId}
            venueName={venue.venue_name || "Your Venue"}
          />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h3>
            <p className="text-yellow-700">
              You don&apos;t have permission to manage staff. This feature is available for Owner
              and Manager roles only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
